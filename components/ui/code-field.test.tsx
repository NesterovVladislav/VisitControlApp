import { fireEvent, render } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import { palettes } from '../../constants/palette';
import { CodeField } from './code-field';

describe('CodeField', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['light', 'dark'] as const)('uses the %s theme and accepts a spaced code', async (scheme) => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);
    const onChangeText = jest.fn();
    const screen = await render(<CodeField label="Код из письма" value="" onChangeText={onChangeText} />);
    const input = screen.getByLabelText('Код из письма');
    await fireEvent.changeText(input, '012 345');
    expect(onChangeText).toHaveBeenCalledWith('012345');
    expect(screen.getByText('Код из письма')).toHaveStyle({ color: palettes[scheme].text });
  });
});
