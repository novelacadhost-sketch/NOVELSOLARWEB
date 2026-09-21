<?php
defined( 'ABSPATH' ) || exit;

/**
 * Stored configuration, with wp-config.php constants winning over the database.
 *
 * The anon key is a publishable Supabase key — it is already shipped to every
 * browser that loads the NovelSolar site — so keeping it in wp_options is not a
 * leak. The constants exist so a managed host can keep config out of the DB
 * entirely, not because the value is secret.
 */
class NSBS_Settings {

	const OPTION = 'nsbs_settings';

	public static function defaults() {
		return array(
			'supabase_url'     => '',
			'supabase_key'     => '',
			// Only needed if the mirror ever serves a relative /api/bitrix-image
			// path; today every stored image is an absolute Cloudinary URL.
			'site_base_url'    => 'https://novelsolar.com',
			'batch_size'       => 40,
			'import_images'    => 'yes',
			'set_sku'          => 'yes',
			// Never 'publish'. Newly discovered products must land invisible so
			// the shop owner chooses what appears, rather than 1000+ bare price
			// rows going live the moment the plugin is switched on.
			'new_status'       => 'draft',   // draft | pending
			'zero_price'       => 'skip',    // skip | import
			'on_removed'       => 'draft',   // draft | trash | leave
			'skip_services'    => 'yes',
			'enabled'          => 'yes',
		);
	}

	public static function all() {
		$saved = get_option( self::OPTION, array() );
		if ( ! is_array( $saved ) ) {
			$saved = array();
		}
		$merged = wp_parse_args( $saved, self::defaults() );

		if ( defined( 'NSBS_SUPABASE_URL' ) && NSBS_SUPABASE_URL ) {
			$merged['supabase_url'] = NSBS_SUPABASE_URL;
		}
		if ( defined( 'NSBS_SUPABASE_ANON_KEY' ) && NSBS_SUPABASE_ANON_KEY ) {
			$merged['supabase_key'] = NSBS_SUPABASE_ANON_KEY;
		}

		return $merged;
	}

	public static function get( $key, $fallback = null ) {
		$all = self::all();
		return array_key_exists( $key, $all ) ? $all[ $key ] : $fallback;
	}

	public static function is( $key ) {
		return 'yes' === self::get( $key );
	}

	/** True when the credentials came from wp-config.php rather than the form. */
	public static function is_locked( $key ) {
		if ( 'supabase_url' === $key ) {
			return defined( 'NSBS_SUPABASE_URL' ) && NSBS_SUPABASE_URL;
		}
		if ( 'supabase_key' === $key ) {
			return defined( 'NSBS_SUPABASE_ANON_KEY' ) && NSBS_SUPABASE_ANON_KEY;
		}
		return false;
	}

	public static function save( array $input ) {
		$defaults = self::defaults();
		$clean    = array();

		$clean['supabase_url']  = untrailingslashit( esc_url_raw( trim( $input['supabase_url'] ?? '' ) ) );
		$clean['supabase_key']  = trim( sanitize_text_field( $input['supabase_key'] ?? '' ) );
		$clean['site_base_url'] = untrailingslashit( esc_url_raw( trim( $input['site_base_url'] ?? $defaults['site_base_url'] ) ) );

		$batch = absint( $input['batch_size'] ?? $defaults['batch_size'] );
		// Above ~100 a shared host starts timing out mid-batch, which leaves the
		// run half-applied; below 5 the chain takes longer than the cron window.
		$clean['batch_size'] = max( 5, min( 100, $batch ?: $defaults['batch_size'] ) );

		foreach ( array( 'import_images', 'set_sku', 'skip_services', 'enabled' ) as $flag ) {
			$clean[ $flag ] = ! empty( $input[ $flag ] ) ? 'yes' : 'no';
		}

		$new_status = $input['new_status'] ?? $defaults['new_status'];
		// 'publish' is intentionally not accepted, even if posted.
		$clean['new_status'] = in_array( $new_status, array( 'draft', 'pending' ), true ) ? $new_status : $defaults['new_status'];

		$zero = $input['zero_price'] ?? $defaults['zero_price'];
		$clean['zero_price'] = in_array( $zero, array( 'skip', 'import' ), true ) ? $zero : $defaults['zero_price'];

		$removed = $input['on_removed'] ?? $defaults['on_removed'];
		$clean['on_removed'] = in_array( $removed, array( 'draft', 'trash', 'leave' ), true ) ? $removed : $defaults['on_removed'];

		update_option( self::OPTION, $clean, false );

		return $clean;
	}

	public static function configured() {
		$all = self::all();
		return ! empty( $all['supabase_url'] ) && ! empty( $all['supabase_key'] );
	}
}
