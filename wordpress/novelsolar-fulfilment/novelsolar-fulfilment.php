<?php
/**
 * Plugin Name:       NovelSolar Order Fulfilment
 * Description:       An Order Fulfilment role that can work WooCommerce orders and reach nothing else in WordPress.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            NovelSolar
 * License:           GPL-2.0-or-later
 * Text Domain:       nsf
 */

defined( 'ABSPATH' ) || exit;

define( 'NSF_VERSION', '1.0.0' );
define( 'NSF_DIR', plugin_dir_path( __FILE__ ) );

/** Renaming this orphans everyone already assigned to it. */
define( 'NSF_ROLE', 'order_fulfilment' );

require_once NSF_DIR . 'includes/class-nsf-role.php';
require_once NSF_DIR . 'includes/class-nsf-lockdown.php';

function nsf_woocommerce_active() {
	return class_exists( 'WooCommerce' );
}

function nsf_boot() {
	if ( ! nsf_woocommerce_active() ) {
		add_action( 'admin_notices', function () {
			echo '<div class="notice notice-error"><p><strong>NovelSolar Order Fulfilment</strong> needs WooCommerce to be installed and active.</p></div>';
		} );
		return;
	}

	// The role is (re)asserted on load as well as on activation: a WooCommerce
	// update can add order capabilities that did not exist when the role was
	// created, and a role missing one of them silently loses the Orders screen.
	NSF_Role::instance()->maybe_sync();
	NSF_Lockdown::instance()->register_hooks();
}
add_action( 'plugins_loaded', 'nsf_boot' );

register_activation_hook( __FILE__, array( 'NSF_Role', 'create' ) );

/**
 * The role is deliberately NOT removed on deactivation. Deleting it would strip
 * the role from every user holding it, and WordPress does not give it back when
 * the plugin is reactivated - those accounts would come back with no role at
 * all. Removal is a separate, explicit action.
 */
