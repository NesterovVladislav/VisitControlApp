/**
 * Браузерная версия photo-form.ts. Объект `{ uri, name, type }` браузерный FormData не понимает
 * (отправил бы строку «[object Object]»), поэтому файл по адресу (blob: или data: после обрезки)
 * сначала читается, а в форму кладётся сам файл.
 */
export async function photoForm(uri: string): Promise<FormData> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const form = new FormData();
  form.append('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
  return form;
}
