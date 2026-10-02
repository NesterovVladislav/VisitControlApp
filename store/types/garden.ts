/**
 * Изменение структуры сада во вкладке «Сад» (docs/garden-screen.md). Одно за раз: диалог названия или подтверждение.
 */
export type GardenEdit =
  | { type: 'saveBranch'; id: string | null; name: string }
  | { type: 'deleteBranch'; id: string }
  | { type: 'saveGroup'; id: string | null; name: string; branchId: string }
  | { type: 'deleteGroup'; id: string };

/** Почему не получилось: экран подбирает текст и действие («Изменить состав») сам. */
export type GardenEditError =
  | { kind: 'nameTaken' }
  /** Удаление непустого филиала (count — групп) или группы (count — детей); count из ответа сервера */
  | { kind: 'notEmpty'; count: number | null }
  /** Филиал или группа удалены на другом устройстве */
  | { kind: 'gone' }
  | { kind: 'network' }
  | { kind: 'generic' };

export interface GardenState {
  /** Сколько активных детей без группы; null — ещё не знаем */
  withoutGroupCount: number | null;
  edit: {
    status: 'idle' | 'saving' | 'done' | 'failed';
    action: GardenEdit | null;
    error: GardenEditError | null;
    /** id созданного филиала или группы — чтобы открыть его после создания */
    createdId: string | null;
  };
}
