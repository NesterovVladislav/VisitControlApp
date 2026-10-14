import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import OptionSheet from '../../../components/option-sheet';
import { useAppDispatch, useAppSelector } from '../../../store';
import {
  approveRequest,
  clearActionError,
  loadRolesStart,
  rejectRequest,
  resendPassword,
} from '../../../store/reducers/requests';
import {
  AssignableRole,
  ChildDecision,
  RegistrationRequestView,
  RequestChild,
  RequestOutcome,
} from '../../../store/types/requests';
import { ageOn, formatPhone } from '../../../utils/input-masks';
import { plural } from '../../../utils/plural';
import { formatBirthDate, roleLabel } from '../../../utils/profile-format';
import { fullName, submittedAt } from '../../../utils/registration-request-format';
import { makeStyles, usePalette } from '../../../hooks/use-palette';

const REASON_MAX_LENGTH = 500;

/** Роли, которые имеет смысл выдать заявителю. Ребёнок и роли связей сюда не попадают */
const APPLICANT_ROLES = ['PARENT', 'EMPLOYEE', 'ADMIN'];

/** Без похожих детей в саду ребёнок по умолчанию создаётся; с похожими — администратор выбирает сам */
function defaultDecision(child: RequestChild): ChildDecision | undefined {
  return child.matches.length === 0 ? { kind: 'CREATE' } : undefined;
}

function sameDecision(a: ChildDecision | undefined, b: ChildDecision): boolean {
  return a?.kind === b.kind && (a.kind !== 'LINK' || (b.kind === 'LINK' && a.childId === b.childId));
}

function childrenSummary(decisions: ChildDecision[]): string {
  const created = decisions.filter((decision) => decision.kind === 'CREATE').length;
  const linked = decisions.filter((decision) => decision.kind === 'LINK').length;
  const parts = [
    created > 0 ? `добавить новых — ${created}` : null,
    linked > 0 ? `связать с записанными в сад — ${linked}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? ` Дети: ${parts.join(', ')}.` : '';
}

function birthDateText(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const age = ageOn(date, new Date());
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year} (${age} ${plural(age, ['год', 'года', 'лет'])})`;
}

function genderText(gender: RegistrationRequestView['gender']): string {
  if (gender === 'FEMALE') {
    return 'женский';
  }
  if (gender === 'MALE') {
    return 'мужской';
  }
  return '—';
}

/**
 * Заявка на регистрацию: данные заявителя, «Подтвердить» и «Отклонить».
 * После действия заявка уходит из списка, а экран показывает результат из state.requests.outcomes.
 */
export default function RequestScreen() {
  const c = usePalette();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const headerHeight = useHeaderHeight();
  const { items, outcomes, processing, actionError, roles } = useAppSelector((state) => state.requests);
  const request = items.find((item) => item.id === id);
  const outcome = id ? outcomes[id] : undefined;
  const busy = processing?.id === id;

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [decisions, setDecisions] = useState<Record<string, ChildDecision>>({});
  const [role, setRole] = useState<AssignableRole | null>(null);
  const [rolePicker, setRolePicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    dispatch(loadRolesStart());
  }, [dispatch]);

  useEffect(() => {
    if (actionError) {
      Alert.alert('Не получилось', actionError, [
        { text: 'OK', onPress: () => dispatch(clearActionError()) },
      ]);
    }
  }, [actionError, dispatch]);

  if (outcome) {
    return <OutcomeView outcome={outcome} busy={busy} onDone={() => router.back()} />;
  }

  if (!request) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Заявка не найдена. Возможно, её уже обработали</Text>
        <TouchableOpacity style={styles.linkButton} onPress={() => router.back()}>
          <Text style={styles.linkText}>К списку заявок</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const children = request.children ?? [];
  const decisionOf = (child: RequestChild) => decisions[child.id] ?? defaultDecision(child);
  const undecided = children.filter((child) => !decisionOf(child));
  const roleName = role?.name ?? request.role ?? 'PARENT';
  const roleOptions = roles.filter((item) => APPLICANT_ROLES.includes(item.name));

  function confirmApprove(target: RegistrationRequestView) {
    const chosen: Record<string, ChildDecision> = {};
    for (const child of children) {
      const decision = decisionOf(child);
      if (decision) {
        chosen[child.id] = decision;
      }
    }
    Alert.alert(
      'Подтвердить заявку?',
      `${target.firstName} получит роль «${roleLabel(roleName)}» и сможет войти в приложение: на ${target.email} ` +
        `придёт письмо с паролем.${childrenSummary(Object.values(chosen))}`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Подтвердить',
          onPress: () => dispatch(approveRequest({ request: target, roleId: role?.id ?? null, decisions: chosen })),
        },
      ]
    );
  }

  function submitReject(target: RegistrationRequestView) {
    dispatch(rejectRequest({ request: target, reason: reason.trim() || null }));
  }

  const rows: [string, string][] = [
    ['Дата рождения', birthDateText(request.birthDate)],
    ['Пол', genderText(request.gender)],
    ['Email', request.email],
    ['Телефон', request.phone ? formatPhone(request.phone) : '—'],
    ['Подана', submittedAt(request.created)],
  ];

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding" keyboardVerticalOffset={headerHeight}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.name}>{fullName(request)}</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Роль</Text>
            <View style={styles.roleRow}>
              <Text style={styles.fieldValue}>
                {roleLabel(roleName)}
                {role && request.role && role.name !== request.role ? `  (в заявке — ${roleLabel(request.role)})` : ''}
              </Text>
              {roleOptions.length > 1 ? (
                <TouchableOpacity
                  onPress={() => setRolePicker(true)}
                  disabled={busy}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Сменить роль"
                >
                  <Text style={styles.smallLink}>Сменить</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.field}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <Text style={styles.fieldValue} selectable>
                {value}
              </Text>
            </View>
          ))}
        </View>

        {children.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {children.length} {plural(children.length, ['ребёнок', 'ребёнка', 'детей'])} в заявке
            </Text>
            {children.map((child) => (
              <ChildDecisionView
                key={child.id}
                child={child}
                decision={decisionOf(child)}
                disabled={busy}
                onChange={(decision) => setDecisions((prev) => ({ ...prev, [child.id]: decision }))}
              />
            ))}
          </View>
        ) : null}

        {rejecting ? (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Причина отказа (необязательно)</Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Например: не нашли ребёнка с такой фамилией"
              placeholderTextColor={c.placeholder}
              multiline
              maxLength={REASON_MAX_LENGTH}
              editable={!busy}
              autoFocus
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
            />
            <Text style={styles.counter}>
              {reason.length} / {REASON_MAX_LENGTH}
            </Text>
            <Text style={styles.hint}>Причину может получить заявитель в письме об отказе</Text>
            <TouchableOpacity
              style={[styles.button, styles.buttonDanger, busy && styles.buttonDisabled]}
              onPress={() => submitReject(request)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy }}
            >
              {busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.buttonText}>Отклонить заявку</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => setRejecting(false)}
              disabled={busy}
            >
              <Text style={styles.linkText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {undecided.length > 0 ? (
              <Text style={styles.hint}>
                Похожий ребёнок уже есть в саду. Выберите для{' '}
                {undecided.map((child) => child.firstName).join(', ')}: это он или новый ребёнок
              </Text>
            ) : null}
            <TouchableOpacity
              style={[styles.button, (busy || undecided.length > 0) && styles.buttonDisabled]}
              onPress={() => confirmApprove(request)}
              disabled={busy || undecided.length > 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy || undecided.length > 0, busy }}
            >
              {busy ? <ActivityIndicator color={c.onPrimary} /> : <Text style={styles.buttonText}>Подтвердить</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => setRejecting(true)}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={[styles.linkText, styles.dangerText]}>Отклонить</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <OptionSheet
        visible={rolePicker}
        title="Роль после подтверждения"
        sections={[
          {
            key: 'roles',
            title: '',
            data: roleOptions.map((item) => ({
              key: item.id,
              label: roleLabel(item.name),
              selected: item.name === roleName,
              onPress: () => setRole(item.name === request.role ? null : item),
            })),
          },
        ]}
        onClose={() => setRolePicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

/**
 * Ребёнок из заявки и выбор: связать с похожим ребёнком сада, создать нового или не добавлять.
 */
function ChildDecisionView({
  child,
  decision,
  disabled,
  onChange,
}: {
  child: RequestChild;
  decision: ChildDecision | undefined;
  disabled: boolean;
  onChange: (decision: ChildDecision) => void;
}) {
  const styles = useStyles();
  const options: { key: string; label: string; value: ChildDecision }[] = [
    ...child.matches.map((match) => ({
      key: match.id,
      label: `Это ${fullName(match)}${match.birthDate ? `, ${formatBirthDate(match.birthDate)}` : ''} — уже в саду`,
      value: { kind: 'LINK', childId: match.id } as ChildDecision,
    })),
    { key: 'create', label: 'Новый ребёнок — добавить в сад', value: { kind: 'CREATE' } },
    { key: 'skip', label: 'Не добавлять', value: { kind: 'SKIP' } },
  ];
  return (
    <View style={styles.child}>
      <Text style={styles.childName}>{fullName(child)}</Text>
      <Text style={styles.childMeta}>
        {[birthDateText(child.birthDate), genderText(child.gender)].join(' · ')}
      </Text>
      {options.map((option) => {
        const selected = sameDecision(decision, option.value);
        return (
          <TouchableOpacity
            key={option.key}
            style={styles.option}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={`${child.firstName}: ${option.label}`}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={styles.optionText}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function OutcomeView({
  outcome,
  busy,
  onDone,
}: {
  outcome: RequestOutcome;
  busy: boolean;
  onDone: () => void;
}) {
  const c = usePalette();
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const { request } = outcome;

  let title: string;
  let text: string;
  if (outcome.result === 'approved') {
    title = 'Заявка подтверждена';
    text = outcome.passwordSent
      ? `${request.firstName} может войти: пароль отправлен на ${request.email}.`
      : `Пользователь активирован, но письмо с паролем на ${request.email} не отправилось.`;
  } else if (outcome.result === 'rejected') {
    title = 'Заявка отклонена';
    text = `${fullName(request)} не сможет войти в приложение.`;
  } else {
    title = 'Заявка уже обработана';
    text = 'Её подтвердил или отклонил другой администратор.';
  }

  const showResend = outcome.result === 'approved' && !outcome.passwordSent;

  return (
    <View style={styles.center}>
      <Text style={styles.outcomeTitle}>{title}</Text>
      <Text style={styles.message}>{text}</Text>
      {outcome.result === 'approved' && outcome.childrenAdded ? (
        <Text style={styles.hint}>
          {outcome.childrenAdded} {plural(outcome.childrenAdded, ['ребёнок', 'ребёнка', 'детей'])} в «Моих детях»
          у {request.firstName}. Распределить детей по группам можно во вкладке «Сад»
        </Text>
      ) : outcome.result === 'approved' && request.role === 'PARENT' ? (
        <Text style={styles.hint}>
          Детей в заявке не было: свяжите родителя с детьми во вкладке «Люди», иначе экран «Мои дети» будет
          пустым
        </Text>
      ) : null}
      {showResend ? (
        <TouchableOpacity
          style={[styles.button, styles.fullWidth, busy && styles.buttonDisabled]}
          onPress={() => dispatch(resendPassword(request.id))}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={c.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Отправить пароль ещё раз</Text>
          )}
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity style={styles.linkButton} onPress={onDone} disabled={busy}>
        <Text style={styles.linkText}>Готово</Text>
      </TouchableOpacity>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    container: {
      padding: 20,
      width: '100%',
      maxWidth: 440,
      alignSelf: 'center',
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: c.background,
      padding: 24,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 20,
      marginBottom: 16,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    name: {
      fontSize: 20,
      fontWeight: '600',
      color: c.text,
      marginBottom: 8,
    },
    field: {
      marginTop: 12,
    },
    fieldLabel: {
      fontSize: 13,
      color: c.textTertiary,
    },
    fieldValue: {
      marginTop: 2,
      fontSize: 16,
      color: c.text,
      flexShrink: 1,
    },
    roleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    smallLink: {
      color: c.primary,
      fontSize: 15,
      fontWeight: '500',
      marginLeft: 12,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: c.text,
    },
    child: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.separator,
    },
    childName: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
    },
    childMeta: {
      marginTop: 2,
      marginBottom: 8,
      fontSize: 14,
      color: c.textSecondary,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    radioSelected: {
      borderColor: c.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.primary,
    },
    optionText: {
      flex: 1,
      fontSize: 15,
      color: c.text,
      lineHeight: 20,
    },
    reasonInput: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      minHeight: 96,
      textAlignVertical: 'top',
      color: c.text,
    },
    counter: {
      marginTop: 4,
      fontSize: 12,
      color: c.textTertiary,
      textAlign: 'right',
    },
    hint: {
      marginTop: 4,
      marginBottom: 8,
      fontSize: 13,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      minHeight: 50,
    },
    fullWidth: {
      alignSelf: 'stretch',
    },
    buttonDanger: {
      backgroundColor: c.danger,
    },
    buttonDisabled: {
      backgroundColor: c.disabled,
    },
    buttonText: {
      color: c.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    linkButton: {
      marginTop: 12,
      paddingVertical: 10,
      alignItems: 'center',
    },
    linkText: {
      color: c.primary,
      fontSize: 16,
      fontWeight: '500',
    },
    dangerText: {
      color: c.danger,
    },
    outcomeTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: c.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    message: {
      fontSize: 16,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 8,
    },
  })
);
