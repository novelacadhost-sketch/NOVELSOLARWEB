<?php
defined( 'ABSPATH' ) || exit;

/**
 * wp nsbs sync    Run a full sync in the foreground.
 * wp nsbs status  Show the last run.
 */
class NSBS_CLI {

	/**
	 * Run a sync to completion without waiting for cron.
	 *
	 * ## OPTIONS
	 *
	 * [--force]
	 * : Start even if a previous run left the lock in place.
	 */
	public function sync( $args, $assoc ) {
		$force = ! empty( $assoc['force'] );
		$sync  = NSBS_Sync::instance();

		$started = $sync->start( $force );
		if ( is_wp_error( $started ) ) {
			WP_CLI::error( $started->get_error_message() );
		}

		$rows  = get_option( NSBS_Sync::PAYLOAD_OPTION, array() );
		$total = is_array( $rows ) ? count( $rows ) : 0;
		$size  = (int) NSBS_Settings::get( 'batch_size', 40 );

		WP_CLI::log( sprintf( 'Pulled %d products from the mirror.', $total ) );
		$progress = WP_CLI\Utils\make_progress_bar( 'Importing', max( 1, (int) ceil( $total / max( 1, $size ) ) ) );

		// Run the chain inline. Scheduled copies of the same batches are
		// harmless: the hash check makes a repeat a no-op.
		for ( $offset = 0; $offset < $total; $offset += $size ) {
			$sync->run_batch( $offset );
			$progress->tick();
		}
		$progress->finish();

		$sync->finish();
		$state = $sync->state();

		WP_CLI::success( sprintf(
			'%d created, %d updated, %d unchanged, %d skipped, %d images, %d retired.',
			$state['created'] ?? 0,
			$state['updated'] ?? 0,
			$state['unchanged'] ?? 0,
			$state['skipped'] ?? 0,
			$state['images'] ?? 0,
			$state['removed'] ?? 0
		) );

		$awaiting = NSBS_Sync::awaiting_review_count();
		if ( $awaiting ) {
			WP_CLI::log( sprintf( '%d product(s) are hidden and waiting for you to publish them.', $awaiting ) );
		}

		if ( ! empty( $state['errors'] ) ) {
			WP_CLI::warning( count( $state['errors'] ) . ' error(s):' );
			foreach ( $state['errors'] as $error ) {
				WP_CLI::log( '  ' . $error );
			}
		}
	}

	/** Show the last run. */
	public function status() {
		$state = NSBS_Sync::instance()->state();

		if ( empty( $state ) ) {
			WP_CLI::log( 'Never run.' );
			return;
		}

		foreach ( $state as $key => $value ) {
			if ( is_array( $value ) ) {
				$value = count( $value ) . ' item(s)';
			}
			if ( in_array( $key, array( 'started_at', 'finished_at' ), true ) && $value ) {
				$value = gmdate( 'Y-m-d H:i:s', (int) $value ) . ' UTC';
			}
			WP_CLI::log( str_pad( $key, 14 ) . $value );
		}

		WP_CLI::log( str_pad( 'awaiting', 14 ) . NSBS_Sync::awaiting_review_count() );
	}
}
