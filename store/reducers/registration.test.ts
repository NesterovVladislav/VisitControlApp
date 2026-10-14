import reducer, {
  loadPolicySuccess,
  registerFailure,
  resetRegistration,
  selectOrganization,
} from './registration';
import { PublicOrganization } from '../types/registration';

const sunshine: PublicOrganization = {
  id: 'org-1',
  name: 'Солнышко',
  address: null,
  logoUrl: null,
  registrationAvailable: true,
};
const chamomile: PublicOrganization = { ...sunshine, id: 'org-2', name: 'Ромашка' };

function withPolicyOf(organization: PublicOrganization) {
  const selected = reducer(reducer(undefined, resetRegistration()), selectOrganization(organization));
  return reducer(selected, loadPolicySuccess({ version: '1', url: 'https://example.test/p' }));
}

describe('registration reducer: kindergarten selection', () => {
  it('drops the policy and asks for consent again when another kindergarten is selected', () => {
    const before = withPolicyOf(sunshine);

    const after = reducer(before, selectOrganization(chamomile));

    expect(after.organization).toEqual(chamomile);
    expect(after.policy).toBeNull();
    expect(after.policyStatus).toBe('loading');
    expect(after.consentResetCount).toBe(before.consentResetCount + 1);
  });

  it('keeps the policy when the same kindergarten is selected again', () => {
    const before = withPolicyOf(sunshine);

    expect(reducer(before, selectOrganization(sunshine))).toBe(before);
  });

  it('goes back to the list without loading a policy', () => {
    const after = reducer(withPolicyOf(sunshine), selectOrganization(null));

    expect(after.organization).toBeNull();
    expect(after.policyStatus).toBe('idle');
  });

  it('keeps an error that arrives after going back to the list', () => {
    const back = reducer(withPolicyOf(sunshine), selectOrganization(null));

    const after = reducer(back, registerFailure({ formError: 'Сад не найден' }));

    expect(after.formError).toBe('Сад не найден');
  });
});
