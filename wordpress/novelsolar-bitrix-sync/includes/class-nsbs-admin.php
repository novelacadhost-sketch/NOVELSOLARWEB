<?php
defined( 'ABSPATH' ) || exit;

class NSBS_Admin {

	const PAGE = 'nsbs-settings';
	const NONCE = 'nsbs_admin';

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function register_hooks() {
		add_action( 'admin_menu', array( $this, 'menu' ) );
		add_action( 'admin_post_nsbs_save', array( $this, 'handle_save' ) );
		add_action( 'admin_post_nsbs_sync', array( $this, 'handle_sync' ) );
		add_action( 'admin_post_nsbs_unlock', array( $this, 'handle_unlock' ) );
		add_filter( 'manage_product_posts_columns', array( $this, 'column' ) );
		add_action( 'manage_product_posts_custom_column', array( $this, 'column_value' ), 10, 2 );
	}

	public function menu() {
		add_submenu_page(
			'woocommerce',
			'Bitrix Sync',
			'Bitrix Sync',
			'manage_woocommerce',
			self::PAGE,
			array( $this, 'render' )
		);
	}

	// -- product list column -------------------------------------------------

	public function column( $columns ) {
		$columns['nsbs_bitrix'] = 'Bitrix ID';
		return $columns;
	}

	public function column_value( $column, $post_id ) {
		if ( 'nsbs_bitrix' !== $column ) {
			return;
		}
		$id = get_post_meta( $post_id, NSBS_META_ID, true );
		echo $id ? esc_html( $id ) : '<span style="color:#999">&mdash;</span>';
	}

	// -- actions -------------------------------------------------------------

	private function guard() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( 'You do not have permission to do that.' );
		}
		check_admin_referer( self::NONCE );
	}

	private function back( $args = array() ) {
		wp_safe_redirect( add_query_arg( $args, admin_url( 'admin.php?page=' . self::PAGE ) ) );
		exit;
	}

	public function handle_save() {
		$this->guard();

		$posted = wp_unslash( $_POST );

		// A locked field posts empty; keep whatever is already stored rather
		// than blanking it.
		if ( NSBS_Settings::is_locked( 'supabase_key' ) || '' === trim( $posted['supabase_key'] ?? '' ) ) {
			$posted['supabase_key'] = NSBS_Settings::get( 'supabase_key' );
		}
		if ( NSBS_Settings::is_locked( 'supabase_url' ) || '' === trim( $posted['supabase_url'] ?? '' ) ) {
			$posted['supabase_url'] = NSBS_Settings::get( 'supabase_url' );
		}

		NSBS_Settings::save( $posted );

		$notice = 'saved';
		if ( ! empty( $posted['nsbs_test'] ) ) {
			$result = ( new NSBS_Client() )->test_connection();
			$notice = is_wp_error( $result ) ? 'testfail' : 'testok';
			if ( is_wp_error( $result ) ) {
				set_transient( 'nsbs_notice_detail', $result->get_error_message(), 60 );
			}
		}

		$this->back( array( 'nsbs_notice' => $notice ) );
	}

	public function handle_sync() {
		$this->guard();

		$result = NSBS_Sync::instance()->start();

		if ( is_wp_error( $result ) ) {
			set_transient( 'nsbs_notice_detail', $result->get_error_message(), 60 );
			$this->back( array( 'nsbs_notice' => 'syncfail' ) );
		}

		$this->back( array( 'nsbs_notice' => 'syncstarted' ) );
	}

	public function handle_unlock() {
		$this->guard();
		delete_transient( NSBS_Sync::LOCK_TRANSIENT );
		$this->back( array( 'nsbs_notice' => 'unlocked' ) );
	}

	// -- view ----------------------------------------------------------------

	private function notice() {
		$key = isset( $_GET['nsbs_notice'] ) ? sanitize_key( $_GET['nsbs_notice'] ) : '';
		if ( ! $key ) {
			return;
		}

		$detail = get_transient( 'nsbs_notice_detail' );
		delete_transient( 'nsbs_notice_detail' );

		$map = array(
			'saved'       => array( 'success', 'Settings saved.' ),
			'testok'      => array( 'success', 'Connected to Supabase successfully.' ),
			'testfail'    => array( 'error', 'Could not reach Supabase.' ),
			'syncstarted' => array( 'success', 'Sync started. It runs in the background; reload this page to follow progress.' ),
			'syncfail'    => array( 'error', 'Could not start the sync.' ),
			'unlocked'    => array( 'success', 'Stuck sync lock cleared.' ),
		);

		if ( ! isset( $map[ $key ] ) ) {
			return;
		}

		list( $type, $message ) = $map[ $key ];
		printf(
			'<div class="notice notice-%s is-dismissible"><p>%s%s</p></div>',
			esc_attr( $type ),
			esc_html( $message ),
			$detail ? ' <code>' . esc_html( $detail ) . '</code>' : ''
		);
	}

	public function render() {
		$s     = NSBS_Settings::all();
		$sync  = NSBS_Sync::instance();
		$state = $sync->state();
		$await = NSBS_Sync::awaiting_review_count();

		$draft_link = admin_url( 'edit.php?post_type=product&post_status=draft' );
		?>
		<div class="wrap">
			<h1>NovelSolar Bitrix Sync</h1>
			<?php $this->notice(); ?>

			<div class="notice notice-info inline" style="margin:16px 0;padding:12px">
				<p style="margin:0">
					<strong>Imported products stay hidden until you publish them.</strong>
					New products always arrive as drafts, and once you publish or
					unpublish a product the sync never changes that again &mdash; it
					only keeps the name, price, category and image up to date.
				</p>
			</div>

			<?php if ( $await ) : ?>
				<div class="notice notice-warning inline" style="margin:16px 0;padding:12px">
					<p style="margin:0">
						<strong><?php echo esc_html( number_format_i18n( $await ) ); ?></strong>
						imported product<?php echo 1 === $await ? '' : 's'; ?> waiting for you to review.
						<a class="button button-small" href="<?php echo esc_url( $draft_link ); ?>">Review drafts</a>
					</p>
				</div>
			<?php endif; ?>

			<h2 class="title">Status</h2>
			<table class="widefat striped" style="max-width:720px">
				<tbody>
					<tr>
						<th style="width:220px">Last run</th>
						<td>
							<?php
							if ( empty( $state['status'] ) ) {
								echo 'Never run.';
							} else {
								echo esc_html( ucfirst( $state['status'] ) );
								if ( ! empty( $state['finished_at'] ) ) {
									echo ' &mdash; ' . esc_html( human_time_diff( $state['finished_at'] ) ) . ' ago';
								}
								if ( ! empty( $state['message'] ) ) {
									echo '<br><code>' . esc_html( $state['message'] ) . '</code>';
								}
							}
							?>
						</td>
					</tr>
					<?php if ( ! empty( $state['status'] ) && 'error' !== $state['status'] ) : ?>
					<tr>
						<th>Progress</th>
						<td>
							<?php
							printf(
								'%s of %s processed',
								esc_html( number_format_i18n( $state['processed'] ?? 0 ) ),
								esc_html( number_format_i18n( $state['total'] ?? 0 ) )
							);
							?>
						</td>
					</tr>
					<tr>
						<th>Result</th>
						<td>
							<?php
							printf(
								'%s created &middot; %s updated &middot; %s unchanged &middot; %s skipped &middot; %s images &middot; %s retired',
								esc_html( number_format_i18n( $state['created'] ?? 0 ) ),
								esc_html( number_format_i18n( $state['updated'] ?? 0 ) ),
								esc_html( number_format_i18n( $state['unchanged'] ?? 0 ) ),
								esc_html( number_format_i18n( $state['skipped'] ?? 0 ) ),
								esc_html( number_format_i18n( $state['images'] ?? 0 ) ),
								esc_html( number_format_i18n( $state['removed'] ?? 0 ) )
							);
							?>
						</td>
					</tr>
					<?php endif; ?>
					<?php if ( ! empty( $state['errors'] ) ) : ?>
					<tr>
						<th>Errors</th>
						<td>
							<details>
								<summary><?php echo esc_html( count( $state['errors'] ) ); ?> recorded</summary>
								<ul style="margin-top:8px">
									<?php foreach ( $state['errors'] as $error ) : ?>
										<li><code><?php echo esc_html( $error ); ?></code></li>
									<?php endforeach; ?>
								</ul>
							</details>
						</td>
					</tr>
					<?php endif; ?>
				</tbody>
			</table>

			<p style="margin-top:16px">
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
					<?php wp_nonce_field( self::NONCE ); ?>
					<input type="hidden" name="action" value="nsbs_sync">
					<button type="submit" class="button button-primary" <?php disabled( ! NSBS_Settings::configured() ); ?>>
						Sync now
					</button>
				</form>
				<?php if ( $sync->is_running() ) : ?>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
						<?php wp_nonce_field( self::NONCE ); ?>
						<input type="hidden" name="action" value="nsbs_unlock">
						<button type="submit" class="button">Clear stuck lock</button>
					</form>
					<em style="margin-left:8px">A sync is currently running.</em>
				<?php endif; ?>
			</p>

			<hr>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<?php wp_nonce_field( self::NONCE ); ?>
				<input type="hidden" name="action" value="nsbs_save">

				<h2 class="title">Connection</h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="supabase_url">Supabase URL</label></th>
						<td>
							<input name="supabase_url" id="supabase_url" type="url" class="regular-text code"
								value="<?php echo esc_attr( $s['supabase_url'] ); ?>"
								<?php disabled( NSBS_Settings::is_locked( 'supabase_url' ) ); ?>
								placeholder="https://yourproject.supabase.co">
							<?php if ( NSBS_Settings::is_locked( 'supabase_url' ) ) : ?>
								<p class="description">Set in <code>wp-config.php</code> via <code>NSBS_SUPABASE_URL</code>.</p>
							<?php endif; ?>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="supabase_key">Supabase anon key</label></th>
						<td>
							<input name="supabase_key" id="supabase_key" type="text" class="large-text code"
								value="<?php echo esc_attr( $s['supabase_key'] ); ?>"
								<?php disabled( NSBS_Settings::is_locked( 'supabase_key' ) ); ?>
								autocomplete="off">
							<p class="description">
								The publishable anon key, not the service role key. This plugin only ever reads.
							</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="site_base_url">NovelSolar site URL</label></th>
						<td>
							<input name="site_base_url" id="site_base_url" type="url" class="regular-text code"
								value="<?php echo esc_attr( $s['site_base_url'] ); ?>">
							<p class="description">Only used to resolve legacy relative image paths.</p>
						</td>
					</tr>
				</table>

				<h2 class="title">Import rules</h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row">New products arrive as</th>
						<td>
							<select name="new_status">
								<option value="draft" <?php selected( $s['new_status'], 'draft' ); ?>>Draft (hidden)</option>
								<option value="pending" <?php selected( $s['new_status'], 'pending' ); ?>>Pending review (hidden)</option>
							</select>
							<p class="description">
								There is deliberately no &ldquo;publish automatically&rdquo; option.
							</p>
						</td>
					</tr>
					<tr>
						<th scope="row">Products with no price</th>
						<td>
							<select name="zero_price">
								<option value="skip" <?php selected( $s['zero_price'], 'skip' ); ?>>Do not import</option>
								<option value="import" <?php selected( $s['zero_price'], 'import' ); ?>>Import anyway</option>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row">Removed from Bitrix</th>
						<td>
							<select name="on_removed">
								<option value="draft" <?php selected( $s['on_removed'], 'draft' ); ?>>Set back to draft</option>
								<option value="trash" <?php selected( $s['on_removed'], 'trash' ); ?>>Move to trash</option>
								<option value="leave" <?php selected( $s['on_removed'], 'leave' ); ?>>Leave alone</option>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row">Options</th>
						<td>
							<label><input type="checkbox" name="enabled" value="1" <?php checked( $s['enabled'], 'yes' ); ?>> Run automatically every hour</label><br>
							<label><input type="checkbox" name="import_images" value="1" <?php checked( $s['import_images'], 'yes' ); ?>> Import product images</label><br>
							<label><input type="checkbox" name="set_sku" value="1" <?php checked( $s['set_sku'], 'yes' ); ?>> Set SKU from the Bitrix ID</label><br>
							<label><input type="checkbox" name="skip_services" value="1" <?php checked( $s['skip_services'], 'yes' ); ?>> Skip the SERVICES category</label>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="batch_size">Products per batch</label></th>
						<td>
							<input name="batch_size" id="batch_size" type="number" min="5" max="100" class="small-text"
								value="<?php echo esc_attr( $s['batch_size'] ); ?>">
							<p class="description">Lower this if your host times out mid-sync.</p>
						</td>
					</tr>
				</table>

				<p class="submit">
					<button type="submit" class="button button-primary">Save changes</button>
					<button type="submit" name="nsbs_test" value="1" class="button">Save &amp; test connection</button>
				</p>
			</form>
		</div>
		<?php
	}
}
