-- ============================================================================
-- PMII Saintek Web — integrasi Composio Platform
--
-- Prinsip:
--   * Identitas aplikasi tidak diganti: satu sesi Composio per akun admin.
--   * Kredensial Composio (COMPOSIO_API_KEY) tidak pernah masuk database;
--     yang disimpan hanya ID sesi yang diterbitkan Composio.
--   * user_id Composio diturunkan dari admin_account.id supaya stabil antar
--     proses, bukan identitas kedua yang terpisah.
-- ============================================================================

CREATE TABLE composio_session (
  admin_id   smallint    PRIMARY KEY REFERENCES admin_account(id) ON DELETE CASCADE,
  user_id    text        NOT NULL UNIQUE,
  session_id text        NOT NULL UNIQUE,
  toolkits   text[]      NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER composio_session_touch
  BEFORE UPDATE ON composio_session
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Deny by default bila Data API penyedia diaktifkan; aplikasi mengakses lewat
-- koneksi server, sama seperti tabel sensitif lain di 001_init.sql.
ALTER TABLE composio_session ENABLE ROW LEVEL SECURITY;
