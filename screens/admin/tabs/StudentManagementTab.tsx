import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
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
import type { Invitation, Profile, Referrer, School } from '../../../types/database';
import { OTHER_REFERRER, OTHER_SCHOOL } from '../../../types/database';
import ChoiceSelect from '../../../components/ChoiceSelect';

type Props = NativeStackScreenProps<AdminStudentsStackParamList, 'StudentList'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function StudentManagementTab({ navigation }: Props) {
  const { profile } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [emailsText, setEmailsText] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSummary, setInviteSummary] = useState<string | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [referrerFilter, setReferrerFilter] = useState('all');
  const [schoolsOpen, setSchoolsOpen] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [schoolError, setSchoolError] = useState<string | null>(null);
  const [schoolSaving, setSchoolSaving] = useState(false);
  const [pendingSchoolDelete, setPendingSchoolDelete] = useState<School | null>(null);
  const [deletingSchool, setDeletingSchool] = useState(false);
  const [referrersOpen, setReferrersOpen] = useState(false);
  const [referrerName, setReferrerName] = useState('');
  const [referrerError, setReferrerError] = useState<string | null>(null);
  const [referrerSaving, setReferrerSaving] = useState(false);
  const [pendingReferrerDelete, setPendingReferrerDelete] = useState<Referrer | null>(null);
  const [deletingReferrer, setDeletingReferrer] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Invitation | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Invitation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    const [invitationsResult, studentsResult, schoolsResult, referrersResult] = await Promise.all([
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'student'),
      supabase.from('schools').select('*').order('name', { ascending: true }),
      supabase.from('referrers').select('*').order('name', { ascending: true }),
    ]);

    if (!invitationsResult.error && invitationsResult.data) {
      setInvitations(invitationsResult.data as Invitation[]);
    }
    if (!studentsResult.error && studentsResult.data) {
      setStudents(studentsResult.data as Profile[]);
    }
    if (!schoolsResult.error && schoolsResult.data) {
      setSchools(schoolsResult.data as School[]);
    }
    if (!referrersResult.error && referrersResult.data) {
      setReferrers(referrersResult.data as Referrer[]);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schools' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referrers' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const handleAddSchool = async () => {
    setSchoolError(null);
    const trimmed = schoolName.trim();
    if (!trimmed) {
      setSchoolError('Enter a school name.');
      return;
    }
    if (schools.some((school) => school.name.toLowerCase() === trimmed.toLowerCase())) {
      setSchoolError('That school is already on the list.');
      return;
    }
    setSchoolSaving(true);
    const { error } = await supabase.from('schools').insert({ name: trimmed });
    setSchoolSaving(false);
    if (error) {
      setSchoolError(error.code === '23505' ? 'That school is already on the list.' : error.message);
      return;
    }
    setSchoolName('');
    loadData();
  };

  const handleConfirmDeleteSchool = async () => {
    if (!pendingSchoolDelete) return;
    setSchoolError(null);
    setDeletingSchool(true);
    const { error } = await supabase.from('schools').delete().eq('id', pendingSchoolDelete.id);
    setDeletingSchool(false);
    if (error) {
      setSchoolError(error.message);
      return;
    }
    if (schoolFilter === pendingSchoolDelete.id) setSchoolFilter('all');
    setPendingSchoolDelete(null);
    loadData();
  };

  const handleAddReferrer = async () => {
    setReferrerError(null);
    const trimmed = referrerName.trim();
    if (!trimmed) {
      setReferrerError('Enter a name.');
      return;
    }
    if (referrers.some((person) => person.name.toLowerCase() === trimmed.toLowerCase())) {
      setReferrerError('That person is already on the list.');
      return;
    }
    setReferrerSaving(true);
    const { error } = await supabase.from('referrers').insert({ name: trimmed });
    setReferrerSaving(false);
    if (error) {
      setReferrerError(error.code === '23505' ? 'That person is already on the list.' : error.message);
      return;
    }
    setReferrerName('');
    loadData();
  };

  const handleConfirmDeleteReferrer = async () => {
    if (!pendingReferrerDelete) return;
    setReferrerError(null);
    setDeletingReferrer(true);
    const { error } = await supabase.from('referrers').delete().eq('id', pendingReferrerDelete.id);
    setDeletingReferrer(false);
    if (error) {
      setReferrerError(error.message);
      return;
    }
    if (referrerFilter === pendingReferrerDelete.id) setReferrerFilter('all');
    setPendingReferrerDelete(null);
    loadData();
  };

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

  const schoolLabelFor = (student: Profile) => {
    if (student.school_id) {
      return schools.find((school) => school.id === student.school_id)?.name ?? student.other_school;
    }
    return student.other_school;
  };

  const referredByLabel = (student: Profile) => {
    if (student.referrer_id) {
      return referrers.find((person) => person.id === student.referrer_id)?.name ?? student.referral_source;
    }
    return student.referral_source;
  };

  const filteredInvitations = invitations.filter((item) => {
    const studentProfile = item.status === 'registered' ? getStudentProfile(item.email) : undefined;
    const name = studentProfile ? `${studentProfile.first_name} ${studentProfile.last_name}` : '';
    if (normalizedQuery) {
      const matchesSearch =
        item.email.toLowerCase().includes(normalizedQuery) ||
        name.toLowerCase().includes(normalizedQuery);
      if (!matchesSearch) return false;
    }
    if (schoolFilter === OTHER_SCHOOL) {
      if (!studentProfile || studentProfile.school_id) return false;
    } else if (schoolFilter !== 'all' && studentProfile?.school_id !== schoolFilter) {
      return false;
    }
    if (referrerFilter === OTHER_REFERRER) {
      if (!studentProfile || studentProfile.referrer_id) return false;
    } else if (referrerFilter !== 'all' && studentProfile?.referrer_id !== referrerFilter) {
      return false;
    }
    return true;
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

      <TouchableOpacity style={styles.manageSchools} onPress={() => setSchoolsOpen(true)}>
        <Text style={styles.manageSchoolsText}>Manage schools</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.manageSchools} onPress={() => setReferrersOpen(true)}>
        <Text style={styles.manageSchoolsText}>Manage referred by</Text>
      </TouchableOpacity>

      <ChoiceSelect
        label="School"
        value={schoolFilter}
        options={[
          { value: 'all', label: 'All schools' },
          ...schools.map((school) => ({ value: school.id, label: school.name })),
          { value: OTHER_SCHOOL, label: 'Others' },
        ]}
        onSelect={setSchoolFilter}
      />
      <ChoiceSelect
        label="Referred by"
        value={referrerFilter}
        options={[
          { value: 'all', label: 'All' },
          ...referrers.map((person) => ({ value: person.id, label: person.name })),
          { value: OTHER_REFERRER, label: 'Others' },
        ]}
        onSelect={setReferrerFilter}
      />

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
            {normalizedQuery || schoolFilter !== 'all' || referrerFilter !== 'all'
              ? 'No students match these filters.'
              : 'No invitations yet.'}
          </Text>
        }
        renderItem={({ item }) => {
          const studentProfile =
            item.status === 'registered' ? getStudentProfile(item.email) : undefined;
          const name = studentProfile ? `${studentProfile.first_name} ${studentProfile.last_name}` : null;
          const schoolLabel = studentProfile ? schoolLabelFor(studentProfile) : undefined;
          const referredBy = studentProfile ? referredByLabel(studentProfile) : undefined;

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
                {schoolLabel ? <Text style={styles.rowMeta}>School: {schoolLabel}</Text> : null}
                {studentProfile?.referral_source || studentProfile?.referrer_id ? (
                  <Text style={styles.rowMeta}>Referred by {referredBy}</Text>
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

      <Modal
        visible={schoolsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSchoolsOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Schools</Text>
            <Text style={styles.modalBody}>
              Students pick one of these when they sign up. Use the School filter on this page to
              see who registered from each school.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="School name"
              placeholderTextColor="#999"
              value={schoolName}
              onChangeText={setSchoolName}
            />
            {schoolError ? <Text style={styles.error}>{schoolError}</Text> : null}
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={handleAddSchool}
              disabled={schoolSaving}
            >
              {schoolSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.inviteButtonText}>Add school</Text>
              )}
            </TouchableOpacity>
            <ScrollView style={styles.schoolList}>
              {schools.length === 0 ? (
                <Text style={styles.emptyText}>No schools yet.</Text>
              ) : (
                schools.map((school) => (
                  <View key={school.id} style={styles.schoolRow}>
                    <Text style={styles.schoolName}>{school.name}</Text>
                    <TouchableOpacity onPress={() => setPendingSchoolDelete(school)} hitSlop={8}>
                      <Text style={styles.deleteAction}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancel, styles.schoolDone]}
              onPress={() => setSchoolsOpen(false)}
            >
              <Text style={styles.modalCancelText}>Done</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={pendingSchoolDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingSchoolDelete(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete school?</Text>
            <Text style={styles.modalBody}>
              {pendingSchoolDelete?.name} will be removed from the sign-up list. Students who
              already chose it will no longer be grouped under that school.
            </Text>
            {schoolError ? <Text style={styles.error}>{schoolError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setPendingSchoolDelete(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDelete]}
                onPress={handleConfirmDeleteSchool}
                disabled={deletingSchool}
              >
                {deletingSchool ? (
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
        visible={referrersOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReferrersOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Referred by</Text>
            <Text style={styles.modalBody}>
              Students pick one of these names when they sign up. Others lets them type a name that
              is not on this list.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Person's name"
              placeholderTextColor="#999"
              value={referrerName}
              onChangeText={setReferrerName}
            />
            {referrerError ? <Text style={styles.error}>{referrerError}</Text> : null}
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={handleAddReferrer}
              disabled={referrerSaving}
            >
              {referrerSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.inviteButtonText}>Add person</Text>
              )}
            </TouchableOpacity>
            <ScrollView style={styles.schoolList}>
              {referrers.length === 0 ? (
                <Text style={styles.emptyText}>No people yet.</Text>
              ) : (
                referrers.map((person) => (
                  <View key={person.id} style={styles.schoolRow}>
                    <Text style={styles.schoolName}>{person.name}</Text>
                    <TouchableOpacity onPress={() => setPendingReferrerDelete(person)} hitSlop={8}>
                      <Text style={styles.deleteAction}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancel, styles.schoolDone]}
              onPress={() => setReferrersOpen(false)}
            >
              <Text style={styles.modalCancelText}>Done</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={pendingReferrerDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingReferrerDelete(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Remove this person?</Text>
            <Text style={styles.modalBody}>
              {pendingReferrerDelete?.name} will be removed from the sign-up list. Students who
              already chose them will no longer be grouped under that name.
            </Text>
            {referrerError ? <Text style={styles.error}>{referrerError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setPendingReferrerDelete(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDelete]}
                onPress={handleConfirmDeleteReferrer}
                disabled={deletingReferrer}
              >
                {deletingReferrer ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  manageSchools: { marginBottom: 12 },
  manageSchoolsText: { color: '#4f46e5', fontWeight: '700', fontSize: 14 },
  schoolList: { maxHeight: 220, marginTop: 12 },
  schoolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  schoolName: { fontSize: 15, color: '#111', flex: 1, marginRight: 12 },
  schoolDone: { alignSelf: 'flex-end', marginTop: 12, marginLeft: 0 },
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
