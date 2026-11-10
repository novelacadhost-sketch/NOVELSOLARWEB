<?php
defined( 'ABSPATH' ) || exit;

/**
 * The Order Fulfilment role.
 *
 * Least privilege on purpose: it holds the WooCommerce *order* capabilities and
 * nothing else. In particular it does NOT hold `manage_woocommerce`, which is
 * what Shop Manager uses and which carries Settings, Status, Reports and
 * extension screens with it. Everything this role cannot reach, it cannot reach
 * because the capability is absent - not because a menu was hidden.
 *
 * Deleting orders is deliberately withheld. An order is a financial record; a
 * fulfilment mistake should be a status change or a note, never a disappearance.
 */
class NSF_Role {

	const VERSION_OPTION = 'nsf_role_version';

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public static function capabilities() {
		return array(
			// Required for wp-admin access at all. Without it WordPress treats
			// the account as front-end only.
			'read'                       => true,

			'read_shop_order'            => true,
			'read_private_shop_orders'   => true,
			'edit_shop_order'            => true,
			'edit_shop_orders'           => true,
			'edit_others_shop_orders'    => true,
			'edit_private_shop_orders'   => true,
			'edit_published_shop_orders' => true,

			// Saving a status change on an existing order runs through the
			// publish capability in WooCommerce's post-type mapping.
			'publish_shop_orders'        => true,
		);
	}

	public static function create() {
		remove_role( NSF_ROLE );
		add_role( NSF_ROLE, 'Order Fulfilment', self::capabilities() );
		update_option( self::VERSION_OPTION, NSF_VERSION, false );
	}

	/**
	 * Add any capability the role is missing, without touching anything an
	 * administrator added by hand (a caps plugin, say). Only ever grants.
	 */
	public function maybe_sync() {
		$role = get_role( NSF_ROLE );

		if ( ! $role ) {
			self::create();
			return;
		}

		if ( get_option( self::VERSION_OPTION ) === NSF_VERSION ) {
			return;
		}

		foreach ( array_keys( self::capabilities() ) as $cap ) {
			if ( ! $role->has_cap( $cap ) ) {
				$role->add_cap( $cap );
			}
		}

		update_option( self::VERSION_OPTION, NSF_VERSION, false );
	}

	public static function user_is_fulfilment( $user = null ) {
		$user = $user ?: wp_get_current_user();

		if ( ! $user || ! $user->exists() ) {
			return false;
		}

		// An administrator who also carries the role keeps full access, so a
		// misassignment cannot lock an admin out of their own site.
		if ( user_can( $user, 'manage_options' ) ) {
			return false;
		}

		return in_array( NSF_ROLE, (array) $user->roles, true );
	}
}
