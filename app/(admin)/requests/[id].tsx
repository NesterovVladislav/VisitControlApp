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
import { useAppDispatch, useAppSelector } from '../../../store';
import {
  approveRequest,
  clearActionError,
  rejectRequest,
  resendPassword,
} from '../../../store/reducers/requests';
import { RegistrationRequestView, RequestOutcome } from '../../../store/types/requests';
import { ageOn, formatPhone } from '../../../utils/input-masks';
import { plural } from '../../../utils/plural';
import { fullName, submittedAt } from '../../../utils/registration-request-format';

const REASON_MAX_LENGTH = 500;

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const headerHeight = useHeaderHeight();
  const { items, outcomes, processing, actionError } = useAppSelector((state) => state.requests);
  const request = items.find((item) => item.id === id);
  const outcome = id ? outcomes[id] : undefined;
  const busy = processing?.id === id;

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const scrollRef = useRef<ScrollView>(null);

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

  function confirmApprove(target: RegistrationRequestView) {
    Alert.alert(
      'Подтвердить заявку?',
      `${target.firstName} сможет войти в приложение: на ${target.email} придёт письмо с паролем.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Подтвердить', onPress: () => dispatch(approveRequest(target)) },
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
          {rows.map(([label, value]) => (
            <View key={label} style={styles.field}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <Text style={styles.fieldValue} selectable>
                {value}
              </Text>
            </View>
          ))}
        </View>

        {rejecting ? (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Причина отказа (необязательно)</Text>
            <TextInput
              style={styles.reasonInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Например: не нашли ребёнка с такой фамилией"
              placeholderTextColor="#999"
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
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Отклонить заявку</Text>}
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
            <TouchableOpacity
              style={[styles.button, busy && styles.buttonDisabled]}
              onPress={() => confirmApprove(request)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy }}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Подтвердить</Text>}
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
    </KeyboardAvoidingView>
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
      {outcome.result === 'approved' ? (
        <Text style={styles.hint}>
          Следующий шаг — связать заявителя с детьми, иначе экран «Мои дети» будет пустым. Это появится
          во вкладке «Люди»
        </Text>
      ) : null}
      {showResend ? (
        <TouchableOpacity
          style={[styles.button, styles.fullWidth, busy && styles.buttonDisabled]}
          onPress={() => dispatch(resendPassword(request.id))}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  field: {
    marginTop: 12,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#888',
  },
  fieldValue: {
    marginTop: 2,
    fontSize: 16,
    color: '#333',
  },
  reasonInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 96,
    textAlignVertical: 'top',
    color: '#333',
  },
  counter: {
    marginTop: 4,
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  hint: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#007AFF',
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
    backgroundColor: '#D32F2F',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  dangerText: {
    color: '#D32F2F',
  },
  outcomeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
});
