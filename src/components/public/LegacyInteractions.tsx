'use client';

import { useEffect } from 'react';

type PageKey = 'home' | 'history' | 'structure' | 'kopri' | 'gallery' | 'legal' | 'advocacy' | 'mapaba';

type ApiFailure = { error?: { code?: string; message?: string; fields?: Record<string, string> } };
type ApiSuccess = { data?: { nomorTiket?: string; nomorRegistrasi?: string } };

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function randomKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function formDataObject(form: HTMLFormElement): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  new FormData(form).forEach((value, key) => {
    if (typeof value === 'string') data[key] = value.trim();
  });
  form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name]').forEach((checkbox) => {
    data[checkbox.name] = checkbox.checked;
  });
  return data;
}

function showAlert(form: HTMLFormElement, message: string, success = false): void {
  const alert = form.querySelector<HTMLElement>('[data-form-alert]');
  if (!alert) return;
  alert.hidden = !message;
  alert.className = success
    ? 'rounded-xl border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700'
    : 'rounded-xl border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700';
  alert.textContent = message;
  alert.setAttribute('role', 'alert');
}

function setFieldError(form: HTMLFormElement, name: string, message: string): void {
  const field = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${CSS.escape(name)}"]`);
  field?.classList.add('input-error');
  field?.setAttribute('aria-invalid', 'true');
  const target = form.querySelector<HTMLElement>(`[data-error-for="${CSS.escape(name)}"]`);
  if (target) {
    target.textContent = message;
    target.classList.remove('hidden');
  }
}

function clearFieldError(form: HTMLFormElement, name: string): void {
  const field = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${CSS.escape(name)}"]`);
  field?.classList.remove('input-error');
  field?.removeAttribute('aria-invalid');
  const target = form.querySelector<HTMLElement>(`[data-error-for="${CSS.escape(name)}"]`);
  if (target) {
    target.textContent = '';
    target.classList.add('hidden');
  }
}

async function jsonRequest<T>(url: string, body: unknown, headers: HeadersInit = {}): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as T & ApiFailure;
  if (!response.ok) {
    const failure = payload as ApiFailure;
    if (failure.error?.fields) throw Object.assign(new Error(failure.error.message), { fields: failure.error.fields });
    throw new Error(failure.error?.message || 'Permintaan gagal diproses. Silakan coba lagi.');
  }
  return payload;
}

function uploadFile(file: File, kind: 'pasFoto' | 'ktm', draft: { draftId: string; token: string }, wrapper: HTMLElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const hidden = document.querySelector<HTMLInputElement>(`input[name="${kind === 'pasFoto' ? 'pasFotoUrl' : 'ktmUrl'}"]`);
    const preview = wrapper.querySelector<HTMLElement>('[data-uploader-preview]');
    const dropzone = wrapper.querySelector<HTMLElement>('[data-uploader-dropzone]');
    const error = wrapper.querySelector<HTMLElement>(`[data-error-for="${kind === 'pasFoto' ? 'pasFotoUrl' : 'ktmUrl'}"]`);
    if (!ALLOWED_MIME.has(file.type)) {
      if (error) { error.textContent = 'Format harus JPG, PNG, atau WebP.'; error.classList.remove('hidden'); }
      reject(new Error('Format harus JPG, PNG, atau WebP.'));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      if (error) { error.textContent = 'Ukuran berkas melebihi batas 3 MB.'; error.classList.remove('hidden'); }
      reject(new Error('Ukuran berkas maksimal 3 MB.'));
      return;
    }
    if (error) { error.textContent = ''; error.classList.add('hidden'); }
    if (dropzone) dropzone.classList.add('hidden');
    if (preview) {
      preview.classList.remove('hidden');
      preview.innerHTML = `<div class="rounded-xl border-slate-200 bg-white p-4"><p class="truncate text-sm font-semibold text-pmii-950">${escapeHtml(file.name)}</p><p class="mt-2 text-xs text-slate-500">Mengunggah…</p></div>`;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('draftId', draft.draftId);
    formData.append('token', draft.token);
    formData.append('kind', kind);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/public/mapaba/uploads');
    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable || !preview) return;
      const percentage = Math.round((event.loaded / event.total) * 100);
      preview.innerHTML = `<div class="rounded-xl border-slate-200 bg-white p-4"><p class="truncate text-sm font-semibold text-pmii-950">${escapeHtml(file.name)}</p><div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full bg-pmii-600" style="width:${percentage}%"></div></div><p class="mt-2 text-xs text-slate-500">Mengunggah… ${percentage}%</p></div>`;
    });
    xhr.addEventListener('load', () => {
      const response = JSON.parse(xhr.responseText || '{}') as {
        // Server hanya mengembalikan referensi opaque (pathname kanonik), bukan URL.
        data?: { reference?: string };
        error?: { message?: string };
      };
      const reference = response.data?.reference;
      if (xhr.status >= 200 && xhr.status < 300 && reference) {
        if (hidden) hidden.value = reference;
        if (preview) preview.innerHTML = `<div class="flex items-start gap-3 rounded-xl border-emerald-200 bg-emerald-50 p-3"><span class="text-sm font-semibold text-emerald-900">✓ Berhasil diunggah</span><span class="truncate text-xs text-emerald-800">${escapeHtml(file.name)}</span><button type="button" data-remove-upload class="text-xs font-semibold text-red-600 underline">Ganti</button></div>`;
        resolve(reference);
      } else {
        if (dropzone) dropzone.classList.remove('hidden');
        if (preview) preview.classList.add('hidden');
        if (error) { error.textContent = response.error?.message || 'Unggahan gagal.'; error.classList.remove('hidden'); }
        reject(new Error(response.error?.message || 'Unggahan gagal.'));
      }
    });
  xhr.addEventListener('error', () => {
    if (dropzone) dropzone.classList.remove('hidden');
    if (preview) preview.classList.add('hidden');
    if (error) { error.textContent = 'Tidak dapat menghubungi server. Periksa koneksi internet Anda.'; error.classList.remove('hidden'); }
    reject(new Error('Tidak dapat menghubungi server.'));
  });
  xhr.send(formData);
});
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

function setupUploaders(): void {
  let draftPromise: Promise<{ draftId: string; token: string }> | null = null;
  const getDraft = () => {
    draftPromise ??= jsonRequest<{ data: { draftId: string; token: string } }>('/api/public/mapaba/uploads', {
      kind: 'pasFoto', fileName: 'draft', mimeType: 'image/jpeg', byteSize: 1,
    }).then((payload) => payload.data).catch((error: unknown) => {
      draftPromise = null;
      throw error;
    });
    return draftPromise;
  };

  document.querySelectorAll<HTMLElement>('[data-uploader]').forEach((wrapper) => {
    const input = wrapper.querySelector<HTMLInputElement>('[data-uploader-input]');
    const dropzone = wrapper.querySelector<HTMLElement>('[data-uploader-dropzone]');
    if (!input) return;
    const kind = wrapper.dataset.uploaderTarget === 'pasFotoUrl' ? 'pasFoto' : 'ktm';
    const choose = async (file?: File) => {
      if (!file) return;
      try {
        const draft = await getDraft();
        await uploadFile(file, kind, draft, wrapper);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unggahan gagal. Silakan coba lagi.';
        const field = kind === 'pasFoto' ? 'pasFotoUrl' : 'ktmUrl';
        const errorElement = wrapper.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
        if (errorElement) {
          errorElement.textContent = message;
          errorElement.classList.remove('hidden');
        }
        wrapper.querySelector<HTMLElement>('[data-uploader-preview]')?.classList.add('hidden');
        dropzone?.classList.remove('hidden');
      }
    };
    input.addEventListener('change', () => void choose(input.files?.[0]));
    dropzone?.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('border-pmii-500', 'bg-pmii-50'); });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('border-pmii-500', 'bg-pmii-50'));
    dropzone?.addEventListener('drop', (event) => { event.preventDefault(); dropzone.classList.remove('border-pmii-500', 'bg-pmii-50'); void choose(event.dataTransfer?.files[0]); });
    wrapper.addEventListener('click', (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-remove-upload]')) return;
      const target = kind === 'pasFoto' ? 'pasFotoUrl' : 'ktmUrl';
      const hidden = document.querySelector<HTMLInputElement>(`input[name="${target}"]`);
      if (hidden) hidden.value = '';
      const error = wrapper.querySelector<HTMLElement>(`[data-error-for="${target}"]`);
      if (error) { error.textContent = ''; error.classList.add('hidden'); }
      input.value = '';
      wrapper.querySelector<HTMLElement>('[data-uploader-preview]')?.classList.add('hidden');
      dropzone?.classList.remove('hidden');
    });
  });

  // Attach draft data to the form after files have been uploaded.
  const form = document.querySelector<HTMLFormElement>('form[data-api-form*="mapaba"]');
  if (form) {
    form.dataset.getDraft = 'pending';
    (form as HTMLFormElement & { __getUploadDraft?: () => Promise<{ draftId: string; token: string }> }).__getUploadDraft = getDraft;
  }
}

function setupForm(form: HTMLFormElement): void {
  form.noValidate = true;
  const isMapaba = form.dataset.apiForm?.includes('mapaba') ?? false;
  form.addEventListener('input', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      if (target.name) clearFieldError(form, target.name);
    }
  });
  form.querySelectorAll<HTMLElement>('[data-counter-for]').forEach((counter) => {
    const field = document.getElementById(counter.dataset.counterFor ?? '') as HTMLTextAreaElement | null;
    if (!field) return;
    const update = () => { counter.textContent = `${field.value.length}/${field.maxLength || '∞'} karakter`; };
    field.addEventListener('input', update);
    update();
  });

  const updateRegistrationState = () => {
    if (!isMapaba) return;
    const closeRaw = form.dataset.registrationCloses || '2026-11-03T23:59:59+07:00';
    const closesAt = new Date(closeRaw).getTime();
    const isOpen = Date.now() <= closesAt;
    const button = form.querySelector<HTMLButtonElement>('[data-submit]');
    const banner = form.closest('[data-form-wrapper]')?.querySelector<HTMLElement>('[data-registration-closed]');
    const title = banner?.querySelector<HTMLElement>('[data-registration-title]');
    const message = banner?.querySelector<HTMLElement>('[data-registration-message]');
    if (button) {
      button.disabled = !isOpen;
      button.classList.toggle('cursor-not-allowed', !isOpen);
      button.classList.toggle('opacity-60', !isOpen);
      button.textContent = isOpen ? 'Kirim Pendaftaran' : 'Pendaftaran Ditutup';
    }
    if (banner) banner.hidden = isOpen;
    if (title && !isOpen) title.textContent = 'Pendaftaran Ditutup';
    if (message && !isOpen) message.textContent = 'Pendaftaran MAPABA SAINTEK Ke-XVII telah ditutup pada 3 November 2026.';
  };
  updateRegistrationState();
  if (isMapaba) window.setInterval(updateRegistrationState, 30_000);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showAlert(form, '');
    let firstInvalid: HTMLElement | null = null;
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input[name], select[name], textarea[name]').forEach((field) => {
      if (field.disabled || field.type === 'hidden') return;
      const value = field.value.trim();
      let message = '';
      if (field.required && (field.type === 'checkbox' ? !(field as HTMLInputElement).checked : !value)) message = `${field.dataset.label || field.name} wajib diisi.`;
      else if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) message = 'Format email tidak valid.';
      else if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        if (field.minLength > 0 && value && value.length < field.minLength) message = `${field.dataset.label || field.name} minimal ${field.minLength} karakter.`;
      }
      if (message) { setFieldError(form, field.name, message); firstInvalid ??= field; }
    });
    if (isMapaba) {
      for (const fieldName of ['pasFotoUrl', 'ktmUrl']) {
        const field = form.querySelector<HTMLInputElement>(`input[name="${fieldName}"]`);
        if (field && !field.value) { setFieldError(form, fieldName, `${fieldName === 'pasFotoUrl' ? 'Pas foto' : 'KTM'} wajib diunggah.`); firstInvalid ??= field; }
      }
    }
    if (firstInvalid) {
      showAlert(form, 'Beberapa kolom masih perlu diperbaiki. Silakan periksa tanda merah di bawah.');
      firstInvalid.focus();
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const submitButton = form.querySelector<HTMLButtonElement>('[data-submit]');
    const originalText = submitButton?.textContent ?? 'Kirim';
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Memproses…'; }
    try {
      const payload = formDataObject(form);
      if (isMapaba) {
        const getDraft = (form as HTMLFormElement & { __getUploadDraft?: () => Promise<{ draftId: string; token: string }> }).__getUploadDraft;
        if (!getDraft) throw new Error('Sesi upload tidak ditemukan. Muat ulang halaman dan unggah berkas kembali.');
        const draft = await getDraft();
        payload.draftId = draft.draftId;
        payload.draftToken = draft.token;
        if (payload.universitas === 'lainnya') {
          const other = form.querySelector<HTMLInputElement>('#universitasLain')?.value.trim();
          if (!other) throw new Error('Nama perguruan tinggi wajib diisi.');
          payload.universitas = other;
        }
      }
      const endpoint = isMapaba ? '/api/public/mapaba/registrations' : '/api/public/advocacy/reports';
      const response = await jsonRequest<ApiSuccess>(endpoint, payload, { 'Idempotency-Key': randomKey() });
      const data = response.data;
      const panel = document.querySelector<HTMLElement>('[data-form-success]');
      if (panel) {
        const ticket = panel.querySelector<HTMLElement>('[data-ticket]');
        if (ticket) ticket.textContent = data?.nomorTiket || data?.nomorRegistrasi || '—';
        form.closest('[data-form-wrapper]')?.classList.add('hidden');
        panel.hidden = false;
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        showAlert(form, 'Data berhasil dikirim.', true);
        form.reset();
      }
    } catch (error) {
      const fields = (error as Error & { fields?: Record<string, string> }).fields;
      if (fields) Object.entries(fields).forEach(([name, message]) => setFieldError(form, name, message));
      showAlert(form, error instanceof Error ? error.message : 'Permintaan gagal diproses.');
    } finally {
      if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalText; }
      updateRegistrationState();
    }
  });
}

function setupUniversitySelect(): void {
  const university = document.querySelector<HTMLSelectElement>('#universitas');
  const other = document.querySelector<HTMLInputElement>('#universitasLain');
  if (!university || !other) return;
  const update = () => {
    const show = university.value === 'lainnya';
    other.classList.toggle('hidden', !show);
    other.required = show;
    if (!show) other.value = '';
  };
  university.addEventListener('change', update);
  update();
}

function setupGallery(): void {
  const grid = document.querySelector<HTMLElement>('.mt-10.grid.gap-5');
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll<HTMLAnchorElement>('[data-gallery-album]'));
  const filterButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Filter album"] button'));
  let visibleCount = 6;
  let activeCategory = 'semua';
  const render = () => {
    let shown = 0;
    cards.forEach((card) => {
      const category = card.querySelector<HTMLElement>('.badge')?.textContent?.trim().toLowerCase() ?? '';
      const matches = activeCategory === 'semua' || category === activeCategory;
      const visible = matches && shown < visibleCount;
      if (matches) shown += 1;
      card.classList.toggle('hidden', !visible);
    });
    const more = document.querySelector<HTMLButtonElement>('.mt-12.text-center button');
    if (more) more.hidden = shown >= cards.filter((card) => {
      const category = card.querySelector<HTMLElement>('.badge')?.textContent?.trim().toLowerCase() ?? '';
      return activeCategory === 'semua' || category === activeCategory;
    }).length;
  };
  filterButtons.forEach((button) => button.addEventListener('click', () => {
    activeCategory = button.textContent?.trim().toLowerCase() ?? 'semua';
    visibleCount = 6;
    filterButtons.forEach((item) => {
      const active = item === button;
      item.setAttribute('aria-pressed', String(active));
      item.classList.toggle('btn-primary', active);
      item.classList.toggle('btn-outline', !active);
    });
    render();
  }));
  document.querySelector<HTMLButtonElement>('.mt-12.text-center button')?.addEventListener('click', () => { visibleCount += 6; render(); });
  grid.addEventListener('click', (event) => {
    const card = (event.target as Element).closest<HTMLAnchorElement>('[data-gallery-album]');
    if (!card) return;
    event.preventDefault();
    const title = card.querySelector<HTMLElement>('.font-display')?.textContent?.trim() ?? 'Album';
    const modal = document.createElement('div');
    modal.className = 'legacy-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `<div class="legacy-modal-content rounded-2xl bg-white p-6 text-center"><h2 class="font-display text-xl font-bold text-pmii-950">${escapeHtml(title)}</h2><p class="mt-3 text-sm text-slate-600">Dokumentasi foto untuk album ini belum tersedia di source referensi.</p><button type="button" class="btn-primary btn-sm mt-5" data-close-modal>Tutup</button></div>`;
    modal.addEventListener('click', (e) => { if (e.target === modal || (e.target instanceof Element && e.target.closest('[data-close-modal]'))) modal.remove(); });
    document.body.append(modal);
  });
  render();
}

function setupUI(): void {
  const header = document.querySelector<HTMLElement>('[data-header]');
  const updateShadow = () => header?.classList.toggle('shadow-card', window.scrollY > 8);
  updateShadow();
  window.addEventListener('scroll', updateShadow, { passive: true });

  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const panel = document.querySelector<HTMLElement>('[data-menu-panel]');
  if (toggle) {
    toggle.onclick = () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      panel?.classList.toggle('hidden', !open);
      const label = toggle.querySelector<HTMLElement>('.sr-only');
      if (label) label.textContent = open ? 'Tutup menu navigasi' : 'Buka menu navigasi';
      toggle.querySelector('[data-icon-open]')?.classList.toggle('hidden', open);
      toggle.querySelector('[data-icon-close]')?.classList.toggle('hidden', !open);
    };
  }
  document.querySelectorAll<HTMLElement>('[data-dropdown]').forEach((dropdown) => {
    const trigger = dropdown.querySelector<HTMLButtonElement>('[data-dropdown-trigger]');
    const menu = dropdown.querySelector<HTMLElement>('[data-dropdown-menu]');
    const setOpen = (open: boolean) => {
      menu?.classList.toggle('invisible', !open);
      menu?.classList.toggle('visible', open);
      menu?.classList.toggle('opacity-0', !open);
      menu?.classList.toggle('opacity-100', open);
      menu?.classList.toggle('translate-y-1', !open);
      menu?.classList.toggle('translate-y-0', open);
      trigger?.setAttribute('aria-expanded', String(open));
    };
    trigger?.addEventListener('click', () => setOpen(trigger.getAttribute('aria-expanded') !== 'true'));
    dropdown.addEventListener('mouseenter', () => setOpen(true));
    dropdown.addEventListener('mouseleave', () => setOpen(false));
  });
  document.querySelectorAll<HTMLElement>('[data-accordion]').forEach((accordion) => {
    const trigger = accordion.querySelector<HTMLButtonElement>('[data-accordion-trigger]');
    const panelElement = accordion.querySelector<HTMLElement>('[data-accordion-panel]');
    trigger?.addEventListener('click', () => {
      const open = trigger.getAttribute('aria-expanded') !== 'true';
      trigger.setAttribute('aria-expanded', String(open));
      panelElement?.classList.toggle('hidden', !open);
      accordion.querySelector('[data-accordion-caret]')?.classList.toggle('rotate-180', open);
    });
  });
  const backToTop = document.querySelector<HTMLButtonElement>('[data-back-to-top]');
  const updateBackToTop = () => {
    const visible = window.scrollY > 600;
    backToTop?.classList.toggle('opacity-0', !visible);
    backToTop?.classList.toggle('translate-y-3', !visible);
    backToTop?.classList.toggle('pointer-events-none', !visible);
  };
  updateBackToTop();
  window.addEventListener('scroll', updateBackToTop, { passive: true });
  backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const revealItems = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target as HTMLElement;
        window.setTimeout(() => element.classList.add('is-visible'), Number(element.dataset.revealDelay || 0));
        observer.unobserve(element);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealItems.forEach((element) => observer.observe(element));
  } else revealItems.forEach((element) => element.classList.add('is-visible'));

  const countdown = document.querySelector<HTMLElement>('[data-countdown]');
  if (countdown) {
    const deadline = new Date(countdown.dataset.countdown || '2026-11-03T23:59:59+07:00').getTime();
    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      const seconds = Math.floor(remaining / 1000);
      const values: Record<string, string> = {
        '[data-countdown-days]': String(Math.floor(seconds / 86400)).padStart(2, '0'),
        '[data-countdown-hours]': String(Math.floor((seconds % 86400) / 3600)).padStart(2, '0'),
        '[data-countdown-minutes]': String(Math.floor((seconds % 3600) / 60)).padStart(2, '0'),
        '[data-countdown-seconds]': String(seconds % 60).padStart(2, '0'),
      };
      Object.entries(values).forEach(([selector, value]) => { const node = countdown.querySelector<HTMLElement>(selector); if (node) node.textContent = value; });
      if (remaining === 0) clearInterval(timer);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
  }
}

export default function LegacyInteractions({ page }: { page: PageKey }) {
  useEffect(() => {
    setupUI();
    if (page === 'advocacy' || page === 'mapaba') {
      document.querySelectorAll<HTMLFormElement>('form[data-api-form]').forEach(setupForm);
    }
    if (page === 'mapaba') { setupUploaders(); setupUniversitySelect(); }
    if (page === 'gallery') setupGallery();
  }, [page]);

  return null;
}
