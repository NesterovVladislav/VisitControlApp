/**
 * Файл для multipart в React Native: FormData принимает объект с адресом файла на устройстве.
 * Асинхронная — ради браузерной версии (photo-form.web.ts), которой нужно сначала прочитать файл.
 */
export async function photoForm(uri: string): Promise<FormData> {
  const form = new FormData();
  form.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  return form;
}
