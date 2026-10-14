import React from 'react';
import SegmentedControl from './segmented-control';
import CheckboxRow from './checkbox-row';

const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (node: React.ReactNode) => string;
};

jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('./form-field', () => ({ useFormFieldStyles: () => ({ error: {} }) }));
jest.mock('../hooks/use-palette', () => ({
  makeStyles: (make: (palette: object) => object) => () => make({
    primary: '#007aff', onPrimary: '#fff', card: '#fff', text: '#222', border: '#ddd',
  }),
}));

it('exposes the chosen and disabled radio state in the actual web DOM', () => {
  const markup = renderToStaticMarkup(<SegmentedControl
    options={[{ value: 'FEMALE', label: 'Женский' }, { value: 'MALE', label: 'Мужской' }]}
    value="MALE" onChange={() => {}} disabled
  />);
  const radios = markup.match(/<[^>]*role="radio"[^>]*>/g) ?? [];
  expect(radios).toHaveLength(2);
  expect(radios[0]).toContain('aria-checked="false"');
  expect(radios[1]).toContain('aria-checked="true"');
  expect(radios.every(tag => tag.includes('aria-disabled="true"'))).toBe(true);
});

it('exposes the patronymic checkbox state and name in the actual web DOM', () => {
  const markup = renderToStaticMarkup(<CheckboxRow checked onChange={() => {}}
    accessibilityLabel="Нет отчества">Нет отчества</CheckboxRow>);
  const checkbox = (markup.match(/<[^>]*role="checkbox"[^>]*>/g) ?? [])[0];
  expect(checkbox).toContain('aria-checked="true"');
  expect(checkbox).toContain('aria-label="Нет отчества"');
});
