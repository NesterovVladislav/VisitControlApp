import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/** Native builds report their installed binary; web and Expo Go report the loaded project. */
export function getAppVersionLabel(): string {
  const useProjectVersion = Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const version = useProjectVersion ? Constants.expoConfig?.version : Application.nativeApplicationVersion;
  if (!version) {
    return 'Версия недоступна';
  }

  const build = useProjectVersion ? null : Application.nativeBuildVersion;
  return `Версия ${version}${build ? ` · сборка ${build}` : ''}`;
}
