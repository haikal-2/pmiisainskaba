-- ---------------------------------------------------------------------------
-- Indeks operasional + pengerasan audit.
--
-- Semua perubahan di sini aditif, kecuali DROP INDEX untuk indeks yang terbukti
-- mubazir. Menerapkan berkas ini tidak menyentuh data.
--
-- CATATAN ANALISIS (hasil EXPLAIN pada PGlite dengan 30.000 baris
-- `mapaba_registration`):
--   * `mapaba_event` bersifat singleton (`CHECK (id = 1)`), sehingga
--     `event_id` pada `mapaba_registration`, `mapaba_agenda`, dan `mapaba_faq`
--     SELALU bernilai 1. Indeks pada kolom bernilai tunggal tidak menambah
--     selektivitas dan tidak dipakai untuk `COUNT(*)` yang mencakup seluruh
--     tabel, jadi indeks `event_id` sengaja TIDAK dibuat di sini.
--   * Tujuh kolom foreign key yang tidak terindeks tetap dibuat indeksnya:
--     kolom-kolom itu bernilai banyak (media, admin) dan menjadi sisi anak dari
--     ON DELETE SET NULL / CASCADE, sehingga setiap penghapusan induk (GC media,
--     hapus akun admin) memindai tabel anak secara sekuensial.
-- ---------------------------------------------------------------------------

-- 1. Foreign key yang belum terindeks pada tabel anak.
CREATE INDEX IF NOT EXISTS admin_session_admin_idx
  ON admin_session (admin_id);

CREATE INDEX IF NOT EXISTS advocacy_note_admin_idx
  ON advocacy_note (admin_id);

CREATE INDEX IF NOT EXISTS audit_event_admin_idx
  ON audit_event (admin_id)
  WHERE admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS gallery_photo_media_idx
  ON gallery_photo (media_id)
  WHERE media_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mapaba_registration_photo_idx
  ON mapaba_registration (photo_media_id)
  WHERE photo_media_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mapaba_registration_ktm_idx
  ON mapaba_registration (ktm_media_id)
  WHERE ktm_media_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS organization_member_photo_idx
  ON organization_member (photo_media_id)
  WHERE photo_media_id IS NOT NULL;

-- 2. Indeks lease_owner mubazir: setiap predikat lease selalu menyertakan
--    kesetaraan pada primary key (`WHERE id = $1 AND lease_owner = $2`), dan
--    EXPLAIN menunjukkan rencana memakai `integration_outbox_pkey`. Tidak ada
--    query yang mencari berdasarkan lease_owner saja.
DROP INDEX IF EXISTS integration_outbox_lease_owner_idx;

-- 3. `updated_at` pada agenda/FAQ tidak pernah diperbarui karena tidak ada
--    trigger, berbeda dengan tabel lain (mapaba_event, mapaba_registration).
--    Samakan perilakunya agar metadata tidak basi.
CREATE TRIGGER mapaba_agenda_touch
  BEFORE UPDATE ON mapaba_agenda
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER mapaba_faq_touch
  BEFORE UPDATE ON mapaba_faq
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();