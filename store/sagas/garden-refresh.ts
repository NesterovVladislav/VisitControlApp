import { put, select } from 'redux-saga/effects';
import { RootState } from '../reducers';
import { loadWithoutGroupCount } from '../reducers/garden';
import { loadPeople, loadPeopleFilters } from '../reducers/people';
import { loadPresentStart } from '../reducers/visits';

/**
 * После изменения филиалов, групп или их состава: счётчики в «Посещении» и «Саде», число детей без группы,
 * а в «Людях», если они открывались, — группы детей и список групп фильтра.
 */
export function* refreshAfterGardenChange() {
  yield put(loadPresentStart({ refresh: true }));
  yield put(loadWithoutGroupCount());
  const { status, filterOptions }: RootState['people'] = yield select((state: RootState) => state.people);
  if (status === 'loaded') {
    yield put(loadPeople({ refresh: true }));
  }
  if (filterOptions.status === 'loaded') {
    yield put(loadPeopleFilters());
  }
}
