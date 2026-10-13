-- ---------------------------------------------------------------------------
-- Pengerasan operasional: lease owner outbox.
--
-- Klaim lease di `integrations/outbox.ts` sebelumnya hanya memajukan
-- `available_at`. Bila pengiriman melewati durasi lease, worker lain dapat
-- mengklaim baris yang sama dan baris bisa ditandai `processed_at` oleh worker
-- yang berbeda dari pemegang lease. Kolom ini membuat pemegang lease eksplisit
-- sehingga:
--   * keberhasilan hanya menutup baris yang benar-benar dipegang worker itu;
--   * kegagalan hanya menjadwalkan retry untuk lease yang masih miliknya,
--     tidak menurunkan attempt/backoff pemilik lease baru.
-- ---------------------------------------------------------------------------
ALTER TABLE integration_outbox ADD COLUMN lease_owner uuid;

CREATE INDEX integration_outbox_lease_owner_idx
  ON integration_outbox (lease_owner)
  WHERE processed_at IS NULL;