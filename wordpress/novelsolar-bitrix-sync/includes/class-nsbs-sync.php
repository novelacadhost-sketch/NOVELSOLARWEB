<?php
defined( 'ABSPATH' ) || exit;

/**
 * Pulls the Supabase mirror into WooCommerce in chained batches.
 *
 * The governing rule of this class: it owns product data, the shop owner owns
 * product visibility. A product the sync has never seen is created hidden. A
 * product that already exists has its name, price, category and image
 * refreshed and its post_status left exactly as the owner set it. There is no
 * setting to turn that off, because the catalogue is ~1150 rows and an
 * accidental publish-everything is not something you can undo by hand.
 */
class NSBS_Sync {

	const CRON_HOOK   = 'nsbs_cron_sync';
	const BATCH_HOOK  = 'nsbs_sync_batch';
	const FINISH_HOOK = 'nsbs_sync_finish';
	const AS_GROUP    = 'nsbs';

	const PAYLOAD_OPTION = 'nsbs_payload';
	const STATE_OPTION   = 'nsbs_state';
	const LOCK_TRANSIENT = 'nsbs_running';

	private static $instance = null;
	private $term_cache = array();

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function register_hooks() {
		add_action( self::CRON_HOOK, array( $this, 'cron_sync' ) );
		add_action( self::BATCH_HOOK, array( $this, 'run_batch' ), 10, 1 );
		add_action( self::FINISH_HOOK, array( $this, 'finish' ) );
	}

	// -- state ---------------------------------------------------------------

	public function state() {
		$state = get_option( self::STATE_OPTION, array() );
		return is_array( $state ) ? $state : array();
	}

	private function set_state( array $state ) {
		update_option( self::STATE_OPTION, $state, false );
	}

	public function is_running() {
		return (bool) get_transient( self::LOCK_TRANSIENT );
	}

	// -- entry points --------------------------------------------------------

	public function cron_sync() {
		if ( ! NSBS_Settings::is( 'enabled' ) ) {
			return;
		}
		$this->start();
	}

	/**
	 * Fetch the whole catalogue, stash it, and queue the first batch.
	 *
	 * @return true|WP_Error
	 */
	public function start( $force = false ) {
		if ( ! NSBS_Settings::configured() ) {
			return new WP_Error( 'nsbs_unconfigured', 'Supabase URL and anon key are not set.' );
		}
		if ( $this->is_running() && ! $force ) {
			return new WP_Error( 'nsbs_running', 'A sync is already in progress.' );
		}

		$client = new NSBS_Client();
		$rows   = $client->fetch_all_products();

		if ( is_wp_error( $rows ) ) {
			$this->set_state( array(
				'status'      => 'error',
				'message'     => $rows->get_error_message(),
				'finished_at' => time(),
			) );
			return $rows;
		}

		update_option( self::PAYLOAD_OPTION, $rows, false );

		// Two hours is well past the longest plausible chain; it exists so a
		// fatal mid-run cannot wedge the plugin permanently.
		set_transient( self::LOCK_TRANSIENT, time(), 2 * HOUR_IN_SECONDS );

		$this->set_state( array(
			'status'     => 'running',
			'started_at' => time(),
			'total'      => count( $rows ),
			'processed'  => 0,
			'created'    => 0,
			'updated'    => 0,
			'unchanged'  => 0,
			'skipped'    => 0,
			'images'     => 0,
			'removed'    => 0,
			'errors'     => array(),
			'seen'       => array(),
		) );

		$this->schedule_batch( 0 );

		return true;
	}

	private function schedule_batch( $offset ) {
		if ( function_exists( 'as_schedule_single_action' ) ) {
			as_schedule_single_action( time(), self::BATCH_HOOK, array( $offset ), self::AS_GROUP );
			return;
		}
		wp_schedule_single_event( time() + 5, self::BATCH_HOOK, array( $offset ) );
	}

	private function schedule_finish() {
		if ( function_exists( 'as_schedule_single_action' ) ) {
			as_schedule_single_action( time(), self::FINISH_HOOK, array(), self::AS_GROUP );
			return;
		}
		wp_schedule_single_event( time() + 5, self::FINISH_HOOK );
	}

	// -- the batch -----------------------------------------------------------

	public function run_batch( $offset = 0 ) {
		$offset = (int) $offset;
		$rows   = get_option( self::PAYLOAD_OPTION, array() );

		if ( ! is_array( $rows ) || empty( $rows ) ) {
			$this->finish();
			return;
		}

		$size  = (int) NSBS_Settings::get( 'batch_size', 40 );
		$slice = array_slice( $rows, $offset, $size );

		if ( empty( $slice ) ) {
			$this->schedule_finish();
			return;
		}

		$map   = $this->existing_map();
		$state = $this->state();

		foreach ( $slice as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			try {
				$this->upsert( $row, $map, $state );
			} catch ( Exception $e ) {
				$state['errors'][] = sprintf(
					'%s (%s): %s',
					isset( $row['name'] ) ? $row['name'] : 'unknown',
					isset( $row['id'] ) ? $row['id'] : '?',
					$e->getMessage()
				);
				// Keep only the tail; a systemic failure would otherwise write a
				// multi-megabyte option row.
				$state['errors'] = array_slice( $state['errors'], -50 );
			}
			$state['processed'] = ( isset( $state['processed'] ) ? $state['processed'] : 0 ) + 1;
		}

		$this->set_state( $state );

		$next = $offset + $size;
		if ( $next < count( $rows ) ) {
			$this->schedule_batch( $next );
		} else {
			$this->schedule_finish();
		}
	}

	/**
	 * bitrix id => post id, in one query.
	 *
	 * A per-product meta_query would be ~1150 round trips; this is one.
	 */
	private function existing_map() {
		global $wpdb;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT pm.meta_value AS bitrix_id, pm.post_id
				 FROM {$wpdb->postmeta} pm
				 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				 WHERE pm.meta_key = %s AND p.post_type = 'product'",
				NSBS_META_ID
			)
		);

		$map = array();
		foreach ( $rows as $row ) {
			$map[ (string) $row->bitrix_id ] = (int) $row->post_id;
		}
		return $map;
	}

	private function upsert( array $row, array $map, array &$state ) {
		$bitrix_id = isset( $row['id'] ) ? (string) $row['id'] : '';
		if ( '' === $bitrix_id ) {
			return;
		}

		$name  = trim( (string) ( isset( $row['name'] ) ? $row['name'] : '' ) );
		$price = isset( $row['price'] ) ? (float) $row['price'] : 0.0;

		if ( '' === $name ) {
			$state['skipped'] = ( isset( $state['skipped'] ) ? $state['skipped'] : 0 ) + 1;
			return;
		}

		// Services are jobs quoted by a person, not things with a cart button.
		$section = (string) ( isset( $row['section_name'] ) ? $row['section_name'] : '' );
		if ( NSBS_Settings::is( 'skip_services' ) && 0 === strcasecmp( $section, 'SERVICES' ) ) {
			$state['skipped'] = ( isset( $state['skipped'] ) ? $state['skipped'] : 0 ) + 1;
			return; // deliberately not marked seen, so the removal pass retires it
		}

		if ( $price <= 0 && 'skip' === NSBS_Settings::get( 'zero_price' ) ) {
			$state['skipped'] = ( isset( $state['skipped'] ) ? $state['skipped'] : 0 ) + 1;
			return;
		}

		$state['seen'][] = $bitrix_id;

		$existing_id = isset( $map[ $bitrix_id ] ) ? $map[ $bitrix_id ] : 0;
		$hash        = md5( wp_json_encode( array(
			$name,
			$price,
			$section,
			isset( $row['image_url'] ) ? $row['image_url'] : '',
			isset( $row['quantity'] ) ? $row['quantity'] : null,
			isset( $row['description'] ) ? $row['description'] : '',
			isset( $row['gallery_urls'] ) ? $row['gallery_urls'] : array(),
		) ) );

		if ( $existing_id && get_post_meta( $existing_id, NSBS_META_HASH, true ) === $hash ) {
			$state['unchanged'] = ( isset( $state['unchanged'] ) ? $state['unchanged'] : 0 ) + 1;
			return;
		}

		$product = $existing_id ? wc_get_product( $existing_id ) : null;
		$is_new  = ! $product;

		if ( $is_new ) {
			$product = new WC_Product_Simple();
			// The one place status is ever assigned on import. Never 'publish'.
			$product->set_status( NSBS_Settings::get( 'new_status', 'draft' ) );
			$product->set_catalog_visibility( 'visible' );
		}
		// Existing products: post_status is untouched, on purpose. Whatever the
		// shop owner chose in wp-admin is the final word.

		$product->set_name( $name );

		if ( $price > 0 ) {
			$product->set_regular_price( (string) $price );
			$product->set_price( (string) $price );
		}

		$description = trim( (string) ( isset( $row['description'] ) ? $row['description'] : '' ) );
		if ( '' !== $description ) {
			$product->set_description( wp_kses_post( $description ) );
		}

		$specs_html = $this->specs_to_html( isset( $row['specs'] ) ? $row['specs'] : null );
		if ( '' !== $specs_html ) {
			$product->set_short_description( $specs_html );
		}

		$this->apply_stock( $product, $row );

		$term_id = $this->resolve_term( $row );
		if ( $term_id ) {
			$product->set_category_ids( array( $term_id ) );
		}

		if ( $is_new && NSBS_Settings::is( 'set_sku' ) ) {
			$sku = 'BX-' . $bitrix_id;
			if ( ! wc_get_product_id_by_sku( $sku ) ) {
				try {
					$product->set_sku( $sku );
				} catch ( WC_Data_Exception $e ) {
					// A duplicate SKU is not worth failing an import over.
					unset( $e );
				}
			}
		}

		$post_id = $product->save();
		if ( ! $post_id ) {
			throw new Exception( 'WooCommerce refused to save the product.' );
		}

		update_post_meta( $post_id, NSBS_META_ID, $bitrix_id );
		update_post_meta( $post_id, NSBS_META_HASH, $hash );

		if ( $is_new ) {
			update_post_meta( $post_id, '_nsbs_imported_at', time() );
			$state['created'] = ( isset( $state['created'] ) ? $state['created'] : 0 ) + 1;
		} else {
			$state['updated'] = ( isset( $state['updated'] ) ? $state['updated'] : 0 ) + 1;
		}

		if ( NSBS_Settings::is( 'import_images' ) && $this->apply_images( $post_id, $row ) ) {
			$state['images'] = ( isset( $state['images'] ) ? $state['images'] : 0 ) + 1;
		}
	}

	/**
	 * The mirror's quantity column is null for every product today, because the
	 * upstream sync reads crm.product.list, which does not return QUANTITY.
	 * Rather than assert a stock level the data cannot support, leave stock
	 * management off until a real number arrives.
	 */
	private function apply_stock( $product, array $row ) {
		$qty = isset( $row['quantity'] ) ? $row['quantity'] : null;

		if ( null === $qty || '' === $qty ) {
			$product->set_manage_stock( false );
			$product->set_stock_status( 'instock' );
			return;
		}

		$qty = (int) $qty;
		$product->set_manage_stock( true );
		$product->set_stock_quantity( $qty );
		$product->set_stock_status( $qty > 0 ? 'instock' : 'outofstock' );
	}

	private function specs_to_html( $specs ) {
		if ( empty( $specs ) || ! is_array( $specs ) ) {
			return '';
		}

		$items = array();
		foreach ( $specs as $key => $value ) {
			if ( is_array( $value ) ) {
				$value = implode( ', ', array_map( 'strval', $value ) );
			}
			$value = trim( (string) $value );
			if ( '' === $value ) {
				continue;
			}
			$items[] = is_string( $key )
				? '<li><strong>' . esc_html( $key ) . ':</strong> ' . esc_html( $value ) . '</li>'
				: '<li>' . esc_html( $value ) . '</li>';
		}

		return $items ? '<ul>' . implode( '', $items ) . '</ul>' : '';
	}

	// -- categories ----------------------------------------------------------

	private function resolve_term( array $row ) {
		$name = trim( (string) ( isset( $row['section_name'] ) ? $row['section_name'] : '' ) );
		if ( '' === $name ) {
			return 0;
		}

		if ( isset( $this->term_cache[ $name ] ) ) {
			return $this->term_cache[ $name ];
		}

		$existing = get_term_by( 'name', $name, 'product_cat' );
		if ( $existing && ! is_wp_error( $existing ) ) {
			$this->term_cache[ $name ] = (int) $existing->term_id;
			return $this->term_cache[ $name ];
		}

		$created = wp_insert_term( $name, 'product_cat' );
		if ( is_wp_error( $created ) ) {
			// A concurrent run may have created it between the read and write.
			$retry = get_term_by( 'name', $name, 'product_cat' );
			$id    = ( $retry && ! is_wp_error( $retry ) ) ? (int) $retry->term_id : 0;
			$this->term_cache[ $name ] = $id;
			return $id;
		}

		$id = (int) $created['term_id'];
		if ( ! empty( $row['section_id'] ) ) {
			update_term_meta( $id, '_nsbs_section_id', (string) $row['section_id'] );
		}
		$this->term_cache[ $name ] = $id;

		return $id;
	}

	// -- images --------------------------------------------------------------

	private function apply_images( $post_id, array $row ) {
		$source = $this->absolute_url( (string) ( isset( $row['image_url'] ) ? $row['image_url'] : '' ) );
		if ( '' === $source ) {
			return false;
		}

		$recorded  = get_post_meta( $post_id, NSBS_META_SOURCE_URL, true );
		$has_thumb = (bool) get_post_thumbnail_id( $post_id );

		// Unchanged source, or an image the shop owner set themselves: leave it.
		if ( $recorded === $source && $has_thumb ) {
			return false;
		}
		if ( $has_thumb && '' === $recorded ) {
			return false;
		}

		$attachment_id = $this->sideload( $source, $post_id );
		if ( ! $attachment_id ) {
			return false;
		}

		set_post_thumbnail( $post_id, $attachment_id );
		update_post_meta( $post_id, NSBS_META_SOURCE_URL, $source );

		$gallery = array();
		$urls    = isset( $row['gallery_urls'] ) ? $row['gallery_urls'] : array();
		if ( is_array( $urls ) ) {
			foreach ( array_slice( $urls, 0, 8 ) as $url ) {
				$abs = $this->absolute_url( (string) $url );
				if ( '' === $abs || $abs === $source ) {
					continue;
				}
				$id = $this->sideload( $abs, $post_id );
				if ( $id ) {
					$gallery[] = $id;
				}
			}
		}

		if ( $gallery ) {
			$product = wc_get_product( $post_id );
			if ( $product ) {
				$product->set_gallery_image_ids( $gallery );
				$product->save();
			}
		}

		return true;
	}

	/**
	 * The mirror stores absolute Cloudinary URLs for products uploaded through
	 * the admin console, but the upstream normalizer can also emit a relative
	 * /api/bitrix-image proxy path for legacy Bitrix images. Those only resolve
	 * against the NovelSolar site.
	 */
	private function absolute_url( $url ) {
		$url = trim( $url );
		if ( '' === $url ) {
			return '';
		}
		if ( preg_match( '#^https?://#i', $url ) ) {
			return $url;
		}
		if ( 0 === strpos( $url, '/' ) ) {
			$base = NSBS_Settings::get( 'site_base_url' );
			return $base ? untrailingslashit( $base ) . $url : '';
		}
		return '';
	}

	/** Reuse an attachment already downloaded from this exact URL. */
	private function sideload( $url, $post_id ) {
		global $wpdb;

		$existing = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value = %s LIMIT 1",
				'_nsbs_attachment_source',
				$url
			)
		);
		if ( $existing ) {
			return (int) $existing;
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$attachment_id = media_sideload_image( $url, $post_id, null, 'id' );
		if ( is_wp_error( $attachment_id ) ) {
			return 0;
		}

		update_post_meta( $attachment_id, '_nsbs_attachment_source', $url );

		return (int) $attachment_id;
	}

	// -- removals ------------------------------------------------------------

	/**
	 * Retire products that are no longer in the Bitrix catalogue.
	 *
	 * This is the only place the sync changes the status of a product it did
	 * not just create, and only downwards - a product gone from Bitrix cannot
	 * stay on sale. Products are drafted rather than deleted by default so
	 * order history keeps resolving.
	 */
	public function finish() {
		$state  = $this->state();
		$policy = NSBS_Settings::get( 'on_removed', 'draft' );

		if ( 'leave' !== $policy && ! empty( $state['seen'] ) && is_array( $state['seen'] ) ) {
			$seen = array_flip( array_map( 'strval', $state['seen'] ) );

			foreach ( $this->existing_map() as $bitrix_id => $post_id ) {
				if ( isset( $seen[ (string) $bitrix_id ] ) ) {
					continue;
				}
				if ( 'publish' !== get_post_status( $post_id ) ) {
					continue; // already hidden; nothing to retire
				}

				if ( 'trash' === $policy ) {
					wp_trash_post( $post_id );
				} else {
					wp_update_post( array( 'ID' => $post_id, 'post_status' => 'draft' ) );
				}
				$state['removed'] = ( isset( $state['removed'] ) ? $state['removed'] : 0 ) + 1;
			}
		}

		$state['status']      = 'complete';
		$state['finished_at'] = time();
		unset( $state['seen'] ); // 1000+ ids do not need to live in the options table

		$this->set_state( $state );

		delete_option( self::PAYLOAD_OPTION );
		delete_transient( self::LOCK_TRANSIENT );
	}

	/** Products imported by this plugin that the owner has not published yet. */
	public static function awaiting_review_count() {
		global $wpdb;

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*)
				 FROM {$wpdb->postmeta} pm
				 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				 WHERE pm.meta_key = %s
				   AND p.post_type = 'product'
				   AND p.post_status IN ( 'draft', 'pending' )",
				NSBS_META_ID
			)
		);
	}
}
