import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Сторона фотографии, которая уходит на сервер. Сервер принимает от 200 до 1024 пикселей и до 300 КБ. */
export const PHOTO_SIDE = 512;
const JPEG_QUALITY = 0.8;

export type PhotoSource = 'camera' | 'library';

export class PhotoPermissionError extends Error {
  constructor(public readonly source: PhotoSource) {
    super(`No permission for ${source}`);
  }
}

/**
 * Снимок с камеры или из галереи, обрезанный до квадрата и сжатый в JPEG 512×512.
 * Геометка и остальные служебные данные при пересохранении не переносятся.
 *
 * @returns адрес файла на устройстве или null, если пользователь передумал
 * @throws PhotoPermissionError — нет доступа к камере или галерее
 */
export async function pickPhoto(source: PhotoSource): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    // Системная обрезка до квадрата: пользователь сам выбирает, что попадёт в кадр
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    exif: false,
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new PhotoPermissionError(source);
    }
    result = await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front });
  } else {
    // Системный выбор фото на Android разрешений не требует, на iOS спрашивает сам
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) {
    return null;
  }
  return squareJpeg(asset.uri, asset.width, asset.height);
}

/**
 * Не на всех устройствах системная обрезка возвращает квадрат, поэтому обрезаем по центру сами.
 */
async function squareJpeg(uri: string, width: number, height: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  const side = Math.min(width, height);
  if (side > 0 && width !== height) {
    context.crop({
      originX: Math.floor((width - side) / 2),
      originY: Math.floor((height - side) / 2),
      width: side,
      height: side,
    });
  }
  context.resize({ width: PHOTO_SIDE, height: PHOTO_SIDE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return saved.uri;
}
