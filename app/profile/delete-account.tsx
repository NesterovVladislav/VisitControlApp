import { useEffect, useRef, useState } from 'react';
import { useHeaderHeight } from '@react-navigation/elements';
import { usePreventRemove } from '@react-navigation/native';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import CheckboxRow from '../../components/checkbox-row';
import FormField from '../../components/form-field';
import { deletionForbidden } from '../../components/profile-account-actions';
import { useProfileLayout } from '../../components/profile-layout';
import { ActionButton } from '../../components/ui';
import { space, typeSize } from '../../constants/ui-tokens';
import { makeStyles } from '../../hooks/use-palette';
import { deleteOwnAccount, getDeletionPreview, type DeletionPreview } from '../../services/api/account-deletion';
import { ApiError } from '../../services/errors/api-error';
import { useAppDispatch, useAppSelector } from '../../store';
import { logoutRequested } from '../../store/reducers/auth';

const inGarden = 'Сначала заберите ребёнка, потом удалите аккаунт';

export default function DeleteAccount() {
  const layout = useProfileLayout();
  const s = useStyles();
  const headerHeight = useHeaderHeight();
  const user = useAppSelector(state => state.auth.user);
  const dispatch = useAppDispatch();
  const [preview, setPreview] = useState<DeletionPreview>();
  const [revision, setRevision] = useState(0);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const previousSelection = useRef<string[] | null>(null);
  usePreventRemove(busy, () => {});
  useEffect(() => {
    const controller = new AbortController();
    setPreview(undefined);
    setFailed(false);
    setPassword('');
    setError('');
    if (user?.role === 'PARENT') {
      getDeletionPreview(controller.signal).then(data => {
        if (controller.signal.aborted) return;
        setPreview(data);
        const eligible = data.children.filter(child => !child.has_other_representatives).map(child => child.external_key);
        const previous = previousSelection.current;
        setSelected(previous ? eligible.filter(key => previous.includes(key)) : eligible);
      }).catch(err => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.data?.code === 'ACCOUNT_DELETION_FORBIDDEN') {
          setPreview({ can_delete: false, children: [] });
        } else setFailed(true);
      });
    }
    return () => controller.abort();
  }, [revision, user?.id, user?.role]);

  const blocked = preview?.children.some(child => child.in_kindergarten && selected.includes(child.external_key));
  async function submit() {
    if (sending.current || user?.role !== 'PARENT' || !preview?.can_delete || !password.trim() || blocked) return;
    sending.current = true;
    setBusy(true);
    setError('');
    Keyboard.dismiss();
    try {
      await deleteOwnAccount(password, selected);
    } catch (err) {
      const data = err instanceof ApiError ? err.data : null;
      if (data?.code === 'ACCOUNT_DELETION_FORBIDDEN') {
        setPreview({ can_delete: false, children: [] });
        setPassword('');
      } else if (data?.code === 'CHILD_IN_KINDERGARTEN') {
        const keys = data.child_external_keys;
        if (Array.isArray(keys) && keys.some(key => selected.includes(key))) {
          setPreview({ ...preview, children: preview.children.map(child => keys.includes(child.external_key)
            ? { ...child, in_kindergarten: true } : child) });
        }
        setError(inGarden);
      } else {
        setError(data?.code === 'WRONG_PASSWORD' ? 'Неверный пароль' :
          'Не удалось удалить аккаунт, попробуйте ещё раз');
      }
      sending.current = false;
      setBusy(false);
      return;
    }
    setPassword('');
    setBusy(false);
    dispatch(logoutRequested({ reason: 'accountDeleted' }));
  }

  return <KeyboardAvoidingView style={layout.screen} behavior="padding" keyboardVerticalOffset={headerHeight}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={layout.content}>
      {user?.role !== 'PARENT' || preview?.can_delete === false ? (
        <View style={layout.block}><Text style={s.text}>{deletionForbidden}</Text></View>
      ) : failed ? <View style={layout.block}>
        <Text style={s.text}>Не удалось загрузить данные для удаления.</Text>
        <ActionButton variant="text" label="Повторить" onPress={() => setRevision(n => n + 1)} />
      </View> : !preview ? <ActivityIndicator accessibilityLabel="Загружаем данные" /> : <>
        <View style={layout.block}><Text style={s.text}>После удаления вы потеряете доступ к аккаунту. Восстановить его нельзя.</Text></View>
        {preview.children.length > 0 && <View style={layout.block}>
          <Text accessibilityRole="header" style={s.title}>Дети</Text>
          {preview.children.map(child => {
            const key = child.external_key;
            const checked = selected.includes(key);
            const name = [child.surname, child.first_name].filter(Boolean).join(' ');
            return <View key={key} style={s.child}>
              <Text style={s.name}>{name}</Text>
              {child.has_other_representatives ? <Text style={s.hint}>Останется в саду, отвяжем только вас.</Text> : <>
                <CheckboxRow checked={checked} disabled={busy} accessibilityLabel={'Удалить и аккаунт ребёнка: ' + name}
                  onChange={value => {
                    setSelected(ids => value ? [...new Set([...ids, key])] : ids.filter(id => id !== key));
                    setError('');
                  }}>Удалить и аккаунт ребёнка</CheckboxRow>
                {!checked && <Text style={s.hint}>Останется в саду без представителя.</Text>}
                {checked && child.in_kindergarten && <Text style={s.warning}>{inGarden}</Text>}
              </>}
            </View>;
          })}
          {blocked && <ActionButton variant="text" label="Обновить статус детей" onPress={() => {
            previousSelection.current = selected;
            setRevision(n => n + 1);
          }} />}
        </View>}
        <View style={layout.block}>
          <FormField label="Текущий пароль" value={password} editable={!busy} secureTextEntry autoComplete="current-password"
            autoCapitalize="none" autoCorrect={false} onChangeText={value => { setPassword(value); setError(''); }} error={error} />
          <ActionButton label="Удалить аккаунт" variant="destructive" loading={busy} disabled={!password.trim() || blocked} onPress={submit} />
        </View>
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
const useStyles = makeStyles(c => StyleSheet.create({
  text: { color: c.text, fontSize: typeSize.body },
  title: { fontWeight: '700', color: c.text, fontSize: typeSize.navigationTitle },
  child: { gap: space.xs, paddingVertical: space.md, marginTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.separator },
  name: { fontSize: typeSize.body, fontWeight: '600', color: c.text },
  hint: { fontSize: typeSize.label, color: c.textSecondary },
  warning: { fontSize: typeSize.label, color: c.danger },
}));
