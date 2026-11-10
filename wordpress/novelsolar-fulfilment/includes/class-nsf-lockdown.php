<?php
defined( 'ABSPATH' ) || exit;

/**
 * Confines the Order Fulfilment role to the WooCommerce Orders screens.
 *
 * Two layers, and the second is the one that counts:
 *
 *   1. Capabilities (NSF_Role) - most of WordPress is already unreachable
 *      because the capability is absent. WordPress core enforces this.
 *   2. An allowlist of admin pages, checked on every admin request. Removing a
 *      menu only hides the link; the page stays reachable by typing its URL,
 *      which is the mistake this class exists to avoid.
 *
 * Menu stripping is cosmetic tidying on top of those, not a boundary.
 */
class NSF_Lockdown {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function register_hooks() {
		// WooCommerce bounces anyone without `manage_woocommerce` or
		// `edit_posts` out of wp-admin to the My Account page. This role has
		// neither, so without this it could never reach the Orders screen.
		add_filter( 'woocommerce_prevent_admin_access', array( $this, 'allow_admin' ) );
		add_filter( 'woocommerce_disable_admin_bar', array( $this, 'keep_admin_bar' ) );

		add_filter( 'login_redirect', array( $this, 'login_redirect' ), 10, 3 );

		add_action( 'admin_init', array( $this, 'restrict_pages' ), 1 );
		add_action( 'admin_menu', array( $this, 'strip_menus' ), 9999 );
		add_action( 'admin_bar_menu', array( $this, 'strip_admin_bar' ), 999 );
		add_action( 'admin_head', array( $this, 'hide_noise' ) );

		// Refunds move money. Fulfilment is not a refunds desk, and the order
		// edit screen offers the button to anyone who can edit the order.
		add_action( 'wp_ajax_woocommerce_refund_line_items', array( $this, 'block_refunds' ), 1 );

		add_filter( 'show_admin_bar', '__return_true' );
	}

	private function active() {
		return NSF_Role::user_is_fulfilment();
	}

	// -- where the orders live ----------------------------------------------

	/**
	 * WooCommerce moved orders out of wp_posts into their own table (HPOS), and
	 * the admin screen has a different URL in each case. Both are supported
	 * because which one a shop uses is a setting, not a version.
	 */
	public static function hpos_enabled() {
		if ( ! class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) ) {
			return false;
		}
		return \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
	}

	public static function orders_url() {
		return self::hpos_enabled()
			? admin_url( 'admin.php?page=wc-orders' )
			: admin_url( 'edit.php?post_type=shop_order' );
	}

	// -- access --------------------------------------------------------------

	public function allow_admin( $prevent ) {
		return $this->active() ? false : $prevent;
	}

	public function keep_admin_bar( $disable ) {
		return $this->active() ? false : $disable;
	}

	public function login_redirect( $redirect_to, $requested, $user ) {
		if ( is_wp_error( $user ) || ! is_a( $user, 'WP_User' ) ) {
			return $redirect_to;
		}
		if ( ! NSF_Role::user_is_fulfilment( $user ) ) {
			return $redirect_to;
		}
		return self::orders_url();
	}

	/**
	 * The allowlist. Anything not named here sends the user back to Orders.
	 */
	private function request_is_allowed() {
		global $pagenow;

		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

		switch ( $pagenow ) {
			case 'admin-ajax.php':
			case 'admin-post.php':
				// The order screens are heavily AJAX-driven; blocking these
				// would break the page rather than secure it. Capabilities are
				// still checked by WooCommerce on each action.
				return true;

			case 'admin.php':
				return 'wc-orders' === $page;

			case 'edit.php':
				return $this->post_type_param() === 'shop_order';

			case 'post.php':
			case 'post-new.php':
				return $this->editing_shop_order();

			case 'profile.php':
				// Their own account, so they can change their password.
				return true;

			default:
				return false;
		}
	}

	private function post_type_param() {
		return isset( $_GET['post_type'] ) ? sanitize_key( wp_unslash( $_GET['post_type'] ) ) : '';
	}

	private function editing_shop_order() {
		if ( 'shop_order' === $this->post_type_param() ) {
			return true;
		}
		if ( empty( $_GET['post'] ) ) {
			return false;
		}
		return 'shop_order' === get_post_type( absint( wp_unslash( $_GET['post'] ) ) );
	}

	public function restrict_pages() {
		if ( ! $this->active() ) {
			return;
		}
		if ( wp_doing_ajax() || ( defined( 'DOING_CRON' ) && DOING_CRON ) ) {
			return;
		}
		if ( $this->request_is_allowed() ) {
			return;
		}

		wp_safe_redirect( self::orders_url() );
		exit;
	}

	public function block_refunds() {
		if ( ! $this->active() ) {
			return;
		}
		wp_send_json_error(
			array( 'error' => 'Refunds are not part of the Order Fulfilment role. Ask an administrator.' )
		);
	}

	// -- tidying -------------------------------------------------------------

	public function strip_menus() {
		if ( ! $this->active() ) {
			return;
		}

		global $menu, $submenu;

		// Kept because the Orders screen is registered underneath it. The user
		// has no `manage_woocommerce`, so WordPress promotes the first submenu
		// they can reach - Orders - to be the clickable parent.
		$keep_top = array( 'woocommerce' );

		foreach ( (array) $menu as $item ) {
			$slug = isset( $item[2] ) ? $item[2] : '';
			if ( '' === $slug || in_array( $slug, $keep_top, true ) ) {
				continue;
			}
			remove_menu_page( $slug );
		}

		// If `manage_woocommerce` is ever granted as the fallback described in
		// the README, this keeps Settings/Status/Reports out of the menu.
		if ( ! empty( $submenu['woocommerce'] ) ) {
			foreach ( $submenu['woocommerce'] as $item ) {
				$slug = isset( $item[2] ) ? $item[2] : '';
				if ( 'wc-orders' === $slug || 'edit.php?post_type=shop_order' === $slug ) {
					continue;
				}
				remove_submenu_page( 'woocommerce', $slug );
			}
		}
	}

	public function strip_admin_bar( $bar ) {
		if ( ! $this->active() ) {
			return;
		}

		foreach ( array( 'new-content', 'comments', 'wp-logo', 'updates', 'customize', 'themes' ) as $node ) {
			$bar->remove_node( $node );
		}
	}

	/**
	 * Other plugins' update nags and promos are noise to someone whose whole job
	 * on this screen is orders, and several of them link where this role cannot
	 * follow.
	 */
	public function hide_noise() {
		if ( ! $this->active() ) {
			return;
		}
		echo '<style>.update-nag,.notice-warning,.woocommerce-message,.wc-addons-wrap,#wp-admin-bar-wp-logo{display:none!important}</style>';
	}
}
