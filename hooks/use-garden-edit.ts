import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { resetGardenEdit, startGardenEdit } from '../store/reducers/garden';
import { GardenEdit, GardenEditError } from '../store/types/garden';

/**
 * Изменение филиала или группы с экрана «Сада». Результат получает только экран, который начал изменение:
 * в стеке открыты сразу несколько экранов вкладки, и все они видят state.garden.edit.
 */
export function useGardenEdit({
  onDone,
  onError,
}: {
  onDone: (createdId: string | null) => void;
  onError: (error: GardenEditError, action: GardenEdit) => void;
}) {
  const dispatch = useAppDispatch();
  const edit = useAppSelector((state) => state.garden.edit);
  const pending = useRef(false);
  const handlers = useRef({ onDone, onError });
  handlers.current = { onDone, onError };

  useEffect(() => {
    if (!pending.current || (edit.status !== 'done' && edit.status !== 'failed')) {
      return;
    }
    pending.current = false;
    if (edit.status === 'done') {
      handlers.current.onDone(edit.createdId);
    } else if (edit.error && edit.action) {
      handlers.current.onError(edit.error, edit.action);
    }
    dispatch(resetGardenEdit());
  }, [dispatch, edit]);

  return {
    saving: pending.current && edit.status === 'saving',
    run(action: GardenEdit) {
      if (edit.status === 'saving') {
        return;
      }
      pending.current = true;
      dispatch(startGardenEdit(action));
    },
  };
}
