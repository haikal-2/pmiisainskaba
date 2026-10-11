-- ============================================================================
-- PMII Saintek Web — skema awal
--
-- Prinsip:
--   * Satu akun admin (singleton) — tidak ada jalur create lewat API.
--   * Data sensitif (peserta, pengaduan, berkas privat) tidak pernah masuk DTO publik.
--   * Nomor tiket/registrasi dibuat server, unik pada level database.
--   * NIM dan telepon disimpan sebagai text agar nol di depan tidak hilang.
-- ============================================================================

-- UUID dan token dibuat kriptografis oleh aplikasi; migrasi tidak bergantung
-- pada extension khusus agar kompatibel dengan PostgreSQL terkelola dan PGlite.

-- ---------------------------------------------------------------------------
-- Utilitas: trigger updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin (singleton)
-- ---------------------------------------------------------------------------
CREATE TABLE admin_account (
  id             smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  username       text        NOT NULL UNIQUE,
  password_hash  text        NOT NULL,
  active         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER admin_account_touch
  BEFORE UPDATE ON admin_account
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE admin_session (
  id           uuid        PRIMARY KEY,
  admin_id     smallint    NOT NULL REFERENCES admin_account(id) ON DELETE CASCADE,
  token_hash   text        NOT NULL UNIQUE,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);

CREATE INDEX admin_session_active_idx
  ON admin_session (expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE audit_event (
  id          bigserial   PRIMARY KEY,
  admin_id    smallint    REFERENCES admin_account(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  resource    text        NOT NULL,
  resource_id text,
  outcome     text        NOT NULL CHECK (outcome IN ('success', 'failure')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_event_created_idx ON audit_event (created_at DESC);

-- ---------------------------------------------------------------------------
-- Konten situs
-- ---------------------------------------------------------------------------
CREATE TABLE site_settings (
  id                 smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brand_name         text        NOT NULL,
  brand_short        text        NOT NULL,
  campus_label       text        NOT NULL,
  tagline            text        NOT NULL,
  motto              text        NOT NULL,
  description        text        NOT NULL,
  email              text        NOT NULL,
  instagram_url      text        NOT NULL,
  instagram_handle   text        NOT NULL,
  whatsapp_primary   text        NOT NULL,
  whatsapp_primary_name text     NOT NULL,
  whatsapp_secondary text        NOT NULL,
  whatsapp_secondary_name text    NOT NULL,
  address            text        NOT NULL,
  map_address_short  text        NOT NULL,
  hero_title_lead    text        NOT NULL,
  hero_title_highlight text      NOT NULL,
  hero_title_tail    text        NOT NULL,
  hero_eyebrow       text        NOT NULL,
  stat_founded       text        NOT NULL,
  stat_members       text        NOT NULL,
  stat_study_programs text       NOT NULL,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER site_settings_touch
  BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE content_section (
  id          bigserial   PRIMARY KEY,
  page_key    text        NOT NULL,
  section_key text        NOT NULL,
  eyebrow     text,
  title       text,
  subtitle    text,
  body        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  sort_order  integer     NOT NULL DEFAULT 0,
  published   boolean     NOT NULL DEFAULT true,
  version     integer     NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_key, section_key)
);

CREATE INDEX content_section_page_idx ON content_section (page_key, sort_order);

CREATE TRIGGER content_section_touch
  BEFORE UPDATE ON content_section
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE timeline_entry (
  id         bigserial   PRIMARY KEY,
  page_key   text        NOT NULL DEFAULT 'sejarah',
  label      text        NOT NULL,
  body       text        NOT NULL,
  accent     text        NOT NULL DEFAULT 'pmii' CHECK (accent IN ('pmii', 'kuning')),
  sort_order integer     NOT NULL DEFAULT 0,
  published  boolean     NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX timeline_entry_page_idx ON timeline_entry (page_key, sort_order);

CREATE TABLE organization_group (
  id         bigserial   PRIMARY KEY,
  slug       text        NOT NULL UNIQUE,
  name       text        NOT NULL,
  period     text        NOT NULL,
  kind       text        NOT NULL CHECK (kind IN ('bph', 'biro', 'kopri')),
  sort_order integer     NOT NULL DEFAULT 0,
  published  boolean     NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_member (
  id           bigserial   PRIMARY KEY,
  group_id     bigint      NOT NULL REFERENCES organization_group(id) ON DELETE CASCADE,
  full_name    text        NOT NULL,
  role         text        NOT NULL,
  initials     text        NOT NULL,
  photo_media_id bigint,
  sort_order   integer     NOT NULL DEFAULT 0,
  published    boolean     NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX organization_member_group_idx ON organization_member (group_id, sort_order);

CREATE TABLE kopri_program (
  id          bigserial   PRIMARY KEY,
  title       text        NOT NULL,
  body        text        NOT NULL,
  link_label  text,
  link_url    text,
  icon_key    text        NOT NULL DEFAULT 'doc',
  sort_order  integer     NOT NULL DEFAULT 0,
  published   boolean     NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gallery_album (
  id            bigserial   PRIMARY KEY,
  slug          text        NOT NULL UNIQUE,
  title         text        NOT NULL,
  category      text        NOT NULL,
  category_slug text        NOT NULL,
  taken_on      date,
  gradient_key  text        NOT NULL DEFAULT 'pmii',
  photo_count   integer     NOT NULL DEFAULT 0,
  sort_order    integer     NOT NULL DEFAULT 0,
  published     boolean     NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gallery_album_category_idx ON gallery_album (category_slug, sort_order);

CREATE TABLE gallery_photo (
  id         bigserial   PRIMARY KEY,
  album_id   bigint      NOT NULL REFERENCES gallery_album(id) ON DELETE CASCADE,
  media_id   bigint,
  alt        text        NOT NULL,
  caption    text,
  sort_order integer     NOT NULL DEFAULT 0,
  published  boolean     NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gallery_photo_album_idx ON gallery_photo (album_id, sort_order);

CREATE TABLE legal_document (
  id           bigserial   PRIMARY KEY,
  title        text        NOT NULL,
  description  text        NOT NULL,
  kind_label   text        NOT NULL,
  kind_tone    text        NOT NULL DEFAULT 'blue' CHECK (kind_tone IN ('blue', 'yellow')),
  icon_key     text        NOT NULL DEFAULT 'doc',
  external_url text        NOT NULL CHECK (external_url ~* '^https://'),
  sort_order   integer     NOT NULL DEFAULT 0,
  published    boolean     NOT NULL DEFAULT true,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- MAPABA
-- ---------------------------------------------------------------------------
CREATE TABLE mapaba_event (
  id              bigint      PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title           text        NOT NULL,
  edition         text        NOT NULL,
  dates_label     text        NOT NULL,
  location_label  text        NOT NULL,
  quota           integer     NOT NULL CHECK (quota > 0),
  contribution_label text     NOT NULL,
  opens_at        timestamptz NOT NULL,
  closes_at       timestamptz NOT NULL,
  time_zone       text        NOT NULL DEFAULT 'Asia/Jakarta',
  faculty         text        NOT NULL,
  published       boolean     NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_at > opens_at)
);

CREATE TRIGGER mapaba_event_touch
  BEFORE UPDATE ON mapaba_event
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE mapaba_agenda (
  id         bigserial PRIMARY KEY,
  event_id   bigint    NOT NULL REFERENCES mapaba_event(id) ON DELETE CASCADE,
  day_label  text      NOT NULL,
  title      text      NOT NULL,
  items      text[]    NOT NULL DEFAULT '{}',
  tone       text      NOT NULL DEFAULT 'blue' CHECK (tone IN ('blue', 'yellow')),
  sort_order integer   NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mapaba_faq (
  id         bigserial PRIMARY KEY,
  event_id   bigint    NOT NULL REFERENCES mapaba_event(id) ON DELETE CASCADE,
  question   text      NOT NULL,
  answer     text      NOT NULL,
  sort_order integer   NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mapaba_registration (
  id                 bigserial   PRIMARY KEY,
  event_id           bigint      NOT NULL REFERENCES mapaba_event(id),
  registration_number text       NOT NULL UNIQUE,
  full_name          text        NOT NULL,
  nim                text        NOT NULL,
  angkatan           text        NOT NULL,
  university         text        NOT NULL,
  faculty            text        NOT NULL,
  study_program      text        NOT NULL,
  whatsapp           text        NOT NULL,
  email              text        NOT NULL,
  gender             text        NOT NULL CHECK (gender IN ('L', 'P')),
  origin_region      text,
  motivation         text        NOT NULL,
  info_source        text,
  organization_history text,
  photo_media_id     bigint,
  ktm_media_id       bigint,
  consent_program    boolean     NOT NULL CHECK (consent_program),
  consent_data       boolean     NOT NULL CHECK (consent_data),
  status             text        NOT NULL DEFAULT 'baru',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, nim),
  UNIQUE (event_id, email)
);

CREATE INDEX mapaba_registration_created_idx ON mapaba_registration (created_at DESC);

CREATE TRIGGER mapaba_registration_touch
  BEFORE UPDATE ON mapaba_registration
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Advokasi
-- ---------------------------------------------------------------------------
CREATE TABLE advocacy_report (
  id               bigserial   PRIMARY KEY,
  ticket           text        NOT NULL UNIQUE,
  reporter_name    text,
  contact          text        NOT NULL,
  email            text,
  reporter_status  text        NOT NULL,
  category         text        NOT NULL,
  chronology       text        NOT NULL,
  evidence_url     text,
  confidential     boolean     NOT NULL DEFAULT false,
  consent          boolean     NOT NULL CHECK (consent),
  status           text        NOT NULL DEFAULT 'baru',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX advocacy_report_created_idx ON advocacy_report (created_at DESC);
CREATE INDEX advocacy_report_status_idx ON advocacy_report (status, created_at DESC);

CREATE TRIGGER advocacy_report_touch
  BEFORE UPDATE ON advocacy_report
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE advocacy_note (
  id         bigserial   PRIMARY KEY,
  report_id  bigint      NOT NULL REFERENCES advocacy_report(id) ON DELETE CASCADE,
  admin_id   smallint    REFERENCES admin_account(id) ON DELETE SET NULL,
  body       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX advocacy_note_report_idx ON advocacy_note (report_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Media & upload
-- ---------------------------------------------------------------------------
CREATE TABLE media_asset (
  id          bigserial   PRIMARY KEY,
  bucket      text        NOT NULL,
  object_key  text        NOT NULL,
  visibility  text        NOT NULL CHECK (visibility IN ('public', 'private')),
  mime_type   text        NOT NULL,
  byte_size   bigint      NOT NULL CHECK (byte_size > 0),
  owner_scope text        NOT NULL,
  state       text        NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'finalized', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  UNIQUE (bucket, object_key)
);

CREATE TABLE upload_draft (
  id            uuid        PRIMARY KEY,
  token_hash    text        NOT NULL UNIQUE,
  scope         text        NOT NULL,
  allowed_paths text[]      NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  finalized_at  timestamptz
);

CREATE INDEX upload_draft_expiry_idx ON upload_draft (expires_at) WHERE finalized_at IS NULL;

-- ---------------------------------------------------------------------------
-- Guard pengiriman (idempotency + rate limit turunan tanpa IP mentah)
-- ---------------------------------------------------------------------------
CREATE TABLE submission_guard (
  id               bigserial   PRIMARY KEY,
  scope            text        NOT NULL,
  idempotency_hash text        NOT NULL,
  result_kind      text,
  result_ref       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  UNIQUE (scope, idempotency_hash)
);

CREATE INDEX submission_guard_expiry_idx ON submission_guard (expires_at);

CREATE TABLE rate_limit_counter (
  id             bigserial   PRIMARY KEY,
  scope          text        NOT NULL,
  subject_hash   text        NOT NULL,
  window_start   timestamptz NOT NULL,
  hits           integer     NOT NULL DEFAULT 0,
  blocked_until  timestamptz,
  UNIQUE (scope, subject_hash, window_start)
);

CREATE INDEX rate_limit_counter_window_idx ON rate_limit_counter (window_start);

-- Outbox: sinkronisasi Google Sheets dapat diulang tanpa kehilangan data utama.
CREATE TABLE integration_outbox (
  id            bigserial   PRIMARY KEY,
  integration   text        NOT NULL CHECK (integration IN ('google-sheets-mapaba', 'google-sheets-advocacy')),
  event_key     text        NOT NULL UNIQUE,
  payload       jsonb       NOT NULL,
  attempts      integer     NOT NULL DEFAULT 0,
  available_at  timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz,
  last_error    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX integration_outbox_pending_idx
  ON integration_outbox (available_at, id)
  WHERE processed_at IS NULL;

ALTER TABLE integration_outbox ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Foreign key ke media_asset (ditambahkan setelah tabel media_asset ada)
-- ---------------------------------------------------------------------------
ALTER TABLE organization_member
  ADD CONSTRAINT organization_member_photo_fk
  FOREIGN KEY (photo_media_id) REFERENCES media_asset(id) ON DELETE SET NULL;

ALTER TABLE gallery_photo
  ADD CONSTRAINT gallery_photo_media_fk
  FOREIGN KEY (media_id) REFERENCES media_asset(id) ON DELETE SET NULL;

ALTER TABLE mapaba_registration
  ADD CONSTRAINT mapaba_registration_photo_fk
  FOREIGN KEY (photo_media_id) REFERENCES media_asset(id) ON DELETE SET NULL;

ALTER TABLE mapaba_registration
  ADD CONSTRAINT mapaba_registration_ktm_fk
  FOREIGN KEY (ktm_media_id) REFERENCES media_asset(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Least privilege: skema ini dipakai lewat koneksi server.
-- RLS diaktifkan pada tabel sensitif sebagai lapisan kedua bila Data API
-- penyedia diaktifkan; tanpa policy, akses anon ditolak (deny by default).
-- ---------------------------------------------------------------------------
ALTER TABLE admin_account        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_session        ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapaba_registration  ENABLE ROW LEVEL SECURITY;
ALTER TABLE advocacy_report      ENABLE ROW LEVEL SECURITY;
ALTER TABLE advocacy_note        ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_asset          ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_draft         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event          ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_guard     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_counter   ENABLE ROW LEVEL SECURITY;
