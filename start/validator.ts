import vine, { SimpleMessagesProvider } from '@vinejs/vine'

// Pesan validasi berbahasa Indonesia; nama kolom diterjemahkan per validator lewat "fields".
vine.messagesProvider = new SimpleMessagesProvider({
    'required': '{{ field }} wajib diisi.',
    'string': '{{ field }} harus berupa teks.',
    'email': '{{ field }} harus berupa alamat email yang valid.',
    'maxLength': '{{ field }} maksimal {{ max }} karakter.',
    'minLength': '{{ field }} minimal {{ min }} karakter.',
    'boolean': '{{ field }} harus bernilai benar atau salah.',
    'number': '{{ field }} harus berupa angka.',
    'min': '{{ field }} minimal {{ min }}.',
    'max': '{{ field }} maksimal {{ max }}.',
    'withoutDecimals': '{{ field }} harus bilangan bulat.',
    'enum': '{{ field }} tidak valid.',
    'in': '{{ field }} tidak valid.',
    'url': '{{ field }} harus berupa alamat yang valid.',
    'regex': 'Format {{ field }} tidak valid.',
    'fixedLength': '{{ field }} harus {{ size }} karakter.',
})
