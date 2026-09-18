import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import type { AdminStudentsStackParamList } from '../../../navigation/AdminStudentsStack';
import type { Invitation, Profile } from '../../../types/database';

type Props = NativeStackScreenProps<AdminStudentsStackParamList, 'StudentList'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function StudentManagementTab({ navigation }: Props) {
  const { profile } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [emailsText, setEmailsText] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSummary, setInviteSummary] = useState<string | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Invitation | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Invitation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    const [invitationsResult, studentsResult] = await Promise.all([
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'student'),
    ]);

    if (!invitationsResult.error && invitationsResult.data) {
      setInvitations(invitationsResult.data as Invitation[]);
    }
    if (!studentsResult.error && studentsResult.data) {
      setStudents(studentsResult.data as Profile[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();

    // Subscribing to postgres_changes gives us the "as soon as a student
    // registers, they show up here automatically" behavior without any
    // manual refresh — Supabase pushes the change over a WebSocket the
    // instant the trigger updates these tables.
    const channel = supabase
      .channel('student-management-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const handleBulkInvite = async () => {
    setInviteError(null);
    setInviteSummary(null);
    if (!profile) return;

    // Split on newlines (and commas, in case someone pastes a
    // comma-separated list instead of one-per-line), trim, lowercase, and
    // drop blank lines.
    const rawEmails = emailsText
      .split(/[\n,]/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);

    if (rawEmails.length === 0) {
      setInviteError('Enter at least one email address.');
      return;
    }

    const uniqueEmails = Array.from(new Set(rawEmails));
    const validEmails = uniqueEmails.filter((e) => EMAIL_REGEX.test(e));
    const invalidEmails = uniqueEmails.filter((e) => !EMAIL_REGEX.test(e));

    if (validEmails.length === 0) {
      setInviteError('None of the entered emails look valid.');
      return;
    }

    setInviteSubmitting(true);

    // Upsert with ignoreDuplicates so one already-invited email doesn't
    // block the rest of the batch: Postgres generates
    // "ON CONFLICT (email) DO NOTHING", which just skips conflicting rows
    // instead of rejecting the whole insert like a plain .insert() would.
    const { data: insertedRows, error } = await supabase
      .from('invitations')
      .upsert(
        validEmails.map((invitedEmail) => ({ email: invitedEmail, invited_by: profile.id })),
        { onConflict: 'email', ignoreDuplicates: true }
      )
      .select();

    setInviteSubmitting(false);

    if (error) {
      setInviteError(error.message);
      return;
    }

    const insertedEmails = new Set((insertedRows ?? []).map((row) => row.email as string));
    const alreadyInvited = validEmails.filter((e) => !insertedEmails.has(e));

    const summaryParts: string[] = [];
    if (insertedEmails.size > 0) {
      summaryParts.push(
        `Invited ${insertedEmails.size} new student${insertedEmails.size === 1 ? '' : 's'}.`
      );
    }
    if (alreadyInvited.length > 0) {
      summaryParts.push(`Already invited: ${alreadyInvited.join(', ')}.`);
    }
    if (invalidEmails.length > 0) {
      summaryParts.push(`Skipped invalid: ${invalidEmails.join(', ')}.`);
    }
    setInviteSummary(summaryParts.join(' '));
    setEmailsText('');
    loadData();
  };

  // Compared case-insensitively: the invite list lowercases what you type,
  // but a profile's email is whatever the student signed up with.
  const getStudentProfile = (inviteEmail: string) =>
    students.find((s) => s.email.toLowerCase() === inviteEmail.toLowerCase());

  const openEdit = (invitation: Invitation) => {
    setActionError(null);
    setEditError(null);
    setEditEmail(invitation.email);
    setEditing(invitation);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditError(null);

    const nextEmail = editEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(nextEmail)) {
      setEditError('That email doesn\u2019t look valid.');
      return;
    }
    if (nextEmail === editing.email) {
      setEditing(null);
      return;
    }

    setEditSaving(true);
    const { error } = await supabase
      .from('invitations')
      .update({ email: nextEmail })
      .eq('id', editing.id);
    setEditSaving(false);

    if (error) {
      // 23505 is Postgres' unique_violation — invitations.email is unique.
      setEditError(
        error.code === '23505' ? 'That email has already been invited.' : error.message
      );
      return;
    }

    setEditing(null);
    loadData();
  };

  // A registered student needs the server-side function: their login lives
  // in auth.users, which the client has no access to. Deleting it cascades
  // through profiles and daily_logs, and clears the invitation too. A
  // pending invite is just a row, so we delete it directly.
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const studentProfile = getStudentProfile(pendingDelete.email);

    setActionError(null);
    setDeleting(true);
    const { error } = studentProfile
      ? await supabase.rpc('admin_delete_student', { target_student_id: studentProfile.id })
      : await supabase.from('invitations').delete().eq('id', pendingDelete.id);
    setDeleting(false);

    if (error) {
      setActionError(error.message);
      return;
    }

    setPendingDelete(null);
    loadData();
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredInvitations = invitations.filter((item) => {
    if (!normalizedQuery) return true;
    const studentProfile = item.status === 'registered' ? getStudentProfile(item.email) : undefined;
    const name = studentProfile ? `${studentProfile.first_name} ${studentProfile.last_name}` : '';
    return (
      item.email.toLowerCase().includes(normalizedQuery) || name.toLowerCase().includes(normalizedQuery)
    );
  });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inviteSection}>
        <Text style={styles.inviteLabel}>Invite students</Text>
        <TextInput
          style={styles.textArea}
          placeholder={'One email per line, e.g.\njane@example.com\njohn@example.com'}
          placeholderTextColor="#999"
          autoCapitalize="none"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          value={emailsText}
          onChangeText={setEmailsText}
        />
        <TouchableOpacity
          style={styles.inviteButton}
          onPress={handleBulkInvite}
          disabled={inviteSubmitting}
        >
          {inviteSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.inviteButtonText}>Invite</Text>
          )}
        </TouchableOpacity>
      </View>
      {inviteError ? <Text style={styles.error}>{inviteError}</Text> : null}
      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      {inviteSummary ? <Text style={styles.summary}>{inviteSummary}</Text> : null}

      <TextInput
        style={styles.searchInput}
        placeholder="Search by name or email"
        placeholderTextColor="#999"
        autoCapitalize="none"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <FlatList
        data={filteredInvitations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {normalizedQuery ? 'No students match your search.' : 'No invitations yet.'}
          </Text>
        }
        renderItem={({ item }) => {
          const studentProfile =
            item.status === 'registered' ? getStudentProfile(item.email) : undefined;
          const name = studentProfile ? `${studentProfile.first_name} ${studentProfile.last_name}` : null;

          return (
            <TouchableOpacity
              style={styles.row}
              disabled={!studentProfile}
              onPress={() =>
                studentProfile &&
                navigation.navigate('StudentDetail', {
                  studentId: studentProfile.id,
                  studentName: name ?? studentProfile.email,
                })
              }
            >
              <View style={styles.rowInfo}>
                <Text style={styles.rowEmail}>{item.email}</Text>
                {name ? <Text style={styles.rowName}>{name}</Text> : null}
                {studentProfile?.phone ? (
                  <Text style={styles.rowMeta}>{studentProfile.phone}</Text>
                ) : null}
                {studentProfile?.referral_source ? (
                  <Text style={styles.rowMeta}>via {studentProfile.referral_source}</Text>
                ) : null}
              </View>
              <View style={styles.rowRight}>
                <View
                  style={[
                    styles.badge,
                    item.status === 'registered' ? styles.badgeRegistered : styles.badgePending,
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {item.status === 'registered' ? 'Registered' : 'Pending'}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  {/* Once someone has registered, the email is their login
                      credential in auth.users — editing only the invitation
                      row here would silently desync the two. */}
                  {studentProfile ? null : (
                    <TouchableOpacity onPress={() => openEdit(item)} hitSlop={8}>
                      <Text style={styles.editAction}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      setActionError(null);
                      setPendingDelete(item);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.deleteAction}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* A real modal instead of Alert.alert: react-native-web stubs Alert
          out to a no-op, so on web the confirm never appeared and nothing
          was ever deleted. */}
      <Modal
        visible={pendingDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingDelete(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {pendingDelete ? (
              <>
                <Text style={styles.modalTitle}>
                  {getStudentProfile(pendingDelete.email) ? 'Remove student?' : 'Delete invitation?'}
                </Text>
                <Text style={styles.modalBody}>
                  {getStudentProfile(pendingDelete.email)
                    ? `${pendingDelete.email} has already registered. This deletes their account and all of their habit history. This cannot be undone.`
                    : `${pendingDelete.email} will no longer be able to register.`}
                </Text>
              </>
            ) : null}
            {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setPendingDelete(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDelete]}
                onPress={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit invitation</Text>
            <TextInput
              style={styles.input}
              placeholder="student@example.com"
              placeholderTextColor="#999"
              autoCapitalize="none"
              keyboardType="email-address"
              value={editEmail}
              onChangeText={setEditEmail}
            />
            {editError ? <Text style={styles.error}>{editError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setEditing(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSave]}
                onPress={handleSaveEdit}
                disabled={editSaving}
              >
                {editSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  inviteSection: { marginBottom: 8 },
  inviteLabel: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6 },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 15,
    minHeight: 90,
  },
  inviteButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  inviteButtonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#dc2626', marginBottom: 8 },
  summary: { color: '#059669', marginBottom: 8 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 4,
  },
  listContent: { paddingTop: 8, paddingBottom: 24 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowInfo: { flex: 1, marginRight: 12 },
  rowEmail: { fontSize: 15, fontWeight: '600' },
  rowName: { fontSize: 13, color: '#666', marginTop: 2 },
  rowMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowActions: { flexDirection: 'row', marginTop: 8 },
  editAction: { fontSize: 13, fontWeight: '600', color: '#4f46e5', marginRight: 16 },
  deleteAction: { fontSize: 13, fontWeight: '600', color: '#dc2626' },
  badge: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
  badgePending: { backgroundColor: '#fef3c7' },
  badgeRegistered: { backgroundColor: '#d1fae5' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#333' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  modalBody: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  modalButton: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginLeft: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  modalCancel: { backgroundColor: '#f3f4f6' },
  modalCancelText: { color: '#444', fontWeight: '600' },
  modalSave: { backgroundColor: '#4f46e5' },
  modalDelete: { backgroundColor: '#dc2626' },
  modalSaveText: { color: '#fff', fontWeight: '600' },
});
