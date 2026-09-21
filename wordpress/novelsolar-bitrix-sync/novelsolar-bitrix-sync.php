<?php
/**
 * Plugin Name:       NovelSolar Bitrix Sync
 * Description:       Keeps WooCommerce products in step with the NovelSolar Bitrix24 catalogue, via the Supabase product mirror.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            NovelSolar
 * License:           GPL-2.0-or-later
 * Text Domain:       nsbs
 */

defined( 'ABSPATH' ) || exit;

define( 'NSBS_VERSION', '1.0.0' );
define( 'NSBS_FILE', __FILE__ );
define( 'NSBS_DIR', plugin_dir_path( __FILE__ ) );

// Bitrix product id -> WooCommerce product. The whole sync hangs off this one
// meta key; renaming it orphans every product already imported.
define( 'NSBS_META_ID', '_nsbs_bitrix_id' );
define( 'NSBS_META_HASH', '_nsbs_hash' );
define( 'NSBS_META_SOURCE_URL', '_nsbs_source_url' );

require_once NSBS_DIR . 'includes/class-nsbs-settings.php';
require_once NSBS_DIR . 'includes/class-nsbs-client.php';
require_once NSBS_DIR . 'includes/class-nsbs-sync.php';
require_once NSBS_DIR . 'includes/class-nsbs-admin.php';

/**
 * WooCommerce is a hard dependency: every write goes through wc_get_product()
 * and WC_Product_Simple. Without it the plugin does nothing but say so.
 */
function nsbs_woocommerce_active() {
	return class_exists( 'WooCommerce' ) && function_exists( 'wc_get_product' );
}

function nsbs_boot() {
	if ( ! nsbs_woocommerce_active() ) {
		add_action( 'admin_notices', function () {
			echo '<div class="notice notice-error"><p><strong>NovelSolar Bitrix Sync</strong> needs WooCommerce to be installed and active.</p></div>';
		} );
		return;
	}

	NSBS_Sync::instance()->register_hooks();
	NSBS_Admin::instance()->register_hooks();

	if ( defined( 'WP_CLI' ) && WP_CLI ) {
		require_once NSBS_DIR . 'includes/class-nsbs-cli.php';
		WP_CLI::add_command( 'nsbs', 'NSBS_CLI' );
	}
}
add_action( 'plugins_loaded', 'nsbs_boot' );

register_activation_hook( __FILE__, function () {
	if ( ! wp_next_scheduled( NSBS_Sync::CRON_HOOK ) ) {
		wp_schedule_event( time() + 300, 'hourly', NSBS_Sync::CRON_HOOK );
	}
} );

register_deactivation_hook( __FILE__, function () {
	wp_clear_scheduled_hook( NSBS_Sync::CRON_HOOK );
	if ( function_exists( 'as_unschedule_all_actions' ) ) {
		as_unschedule_all_actions( NSBS_Sync::BATCH_HOOK, array(), NSBS_Sync::AS_GROUP );
		as_unschedule_all_actions( NSBS_Sync::FINISH_HOOK, array(), NSBS_Sync::AS_GROUP );
	}
} );
