<?php
defined( 'ABSPATH' ) || exit;

/**
 * Reads the Supabase product mirror over PostgREST.
 *
 * Deliberately the mirror and not the NovelSolar /api/inventory endpoint: that
 * one is dealer-gated, sends Cache-Control: private, no-store, and resolves
 * pricing per request, so it is the wrong shape for a bulk pull. The mirror is
 * the same source the Flutter app reads, refreshed by the daily sync and by the
 * Bitrix outbound webhook.
 */
class NSBS_Client {

	/** PostgREST caps a response at 1000 rows however wide the Range header is. */
	const PAGE_SIZE = 500;
	const MAX_PAGES = 40;

	private $base;
	private $key;

	public function __construct( $base = null, $key = null ) {
		$this->base = $base ?: NSBS_Settings::get( 'supabase_url' );
		$this->key  = $key ?: NSBS_Settings::get( 'supabase_key' );
	}

	private function headers() {
		return array(
			'apikey'        => $this->key,
			'Authorization' => 'Bearer ' . $this->key,
			'Accept'        => 'application/json',
		);
	}

	/**
	 * Every active product, paged. Ordered by id so the page boundaries are
	 * stable — without an explicit order PostgREST may return rows in a
	 * different order per page and the sync would both miss and double-import.
	 *
	 * @return array|WP_Error
	 */
	public function fetch_all_products() {
		$rows    = array();
		$offset  = 0;
		$columns = 'id,name,price,description,specs,gallery_urls,image_url,quantity,section_id,section_name';

		for ( $page = 0; $page < self::MAX_PAGES; $page++ ) {
			$url = add_query_arg(
				array(
					'select' => $columns,
					'order'  => 'id.asc',
					'limit'  => self::PAGE_SIZE,
					'offset' => $offset,
				),
				$this->base . '/rest/v1/public_products'
			);

			$response = wp_remote_get( $url, array(
				'headers' => $this->headers(),
				'timeout' => 30,
			) );

			if ( is_wp_error( $response ) ) {
				return $response;
			}

			$code = wp_remote_retrieve_response_code( $response );
			if ( $code < 200 || $code >= 300 ) {
				return new WP_Error(
					'nsbs_http',
					sprintf( 'Supabase returned HTTP %d: %s', $code, wp_remote_retrieve_body( $response ) )
				);
			}

			$batch = json_decode( wp_remote_retrieve_body( $response ), true );
			if ( ! is_array( $batch ) ) {
				return new WP_Error( 'nsbs_decode', 'Supabase returned a body that is not a JSON array.' );
			}

			$rows = array_merge( $rows, $batch );

			if ( count( $batch ) < self::PAGE_SIZE ) {
				return $rows;
			}
			$offset += self::PAGE_SIZE;
		}

		// Hitting the page ceiling means the catalogue outgrew this loop rather
		// than that the pull finished. Returning a truncated list would let the
		// removal pass draft everything past the ceiling.
		return new WP_Error( 'nsbs_too_many', 'Stopped after ' . self::MAX_PAGES . ' pages; the catalogue is larger than expected.' );
	}

	/** A cheap credentials check for the settings screen. */
	public function test_connection() {
		$url = add_query_arg(
			array( 'select' => 'id', 'limit' => 1 ),
			$this->base . '/rest/v1/public_products'
		);

		$response = wp_remote_get( $url, array(
			'headers' => $this->headers(),
			'timeout' => 15,
		) );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		if ( 200 !== $code ) {
			return new WP_Error( 'nsbs_http', sprintf( 'HTTP %d — %s', $code, wp_remote_retrieve_body( $response ) ) );
		}

		return true;
	}
}
