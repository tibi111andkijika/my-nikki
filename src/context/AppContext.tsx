// src/context/AppContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import dayjs from 'dayjs';
import 'dayjs/locale/ja'; 
import { useLocation, useNavigate } from 'react-router-dom';

type Language = 'ja' | 'en' | 'es' | 'fr';

// Zodのエラーメッセージ用の型定義
interface ZodErrorTranslations {
  required: string;
  string_min: string;
  string_max: string;
  invalid_type: string;
  invalid_string_email: string;
  too_small?: string;
  too_big?: string;
  invalid_enum_value?: string;
  invalid_date?: string;
  invalid_arguments?: string;
  invalid_return_type?: string;
  invalid_union?: string;
  not_finite?: string;
  end_time_after_start_time: string;
  content_or_time_required: string;
  invalid_search_term: string;
  invalid_username_format: string;
}

interface Translations {
  settings: string;
  username: string;
  following: string;
  followers: string;
  profileEdit: string;
  languageSetting: string;
  darkMode: string;
  saveFailed: string;
  add: string;
  cancel: string;
  addevent: string;
  start: string;
  finish: string;
  content: string;
  friends: string;
  world: string;
  userserch: string;
  serch: string;
  user: string;
  follow: string;
  followrequet: string;
  profile: string;
  approval: string;
  rejection: string;
  userprofile: string;
  unfollow: string;
  wait: string;
  followrequest: string;
  approvalrequest: string;
  Post: string;
  Postconent: string;
  Follower: string;
  form: string;
  delete: string;
  deletepost: string;
  repeat: string;
  complete: string;
  save: string;
  contactUs: string;
  contactUsDescription: string;
  openContactForm: string;
  deleteAccount: string;
  deleteAccountWarning: string;
  deleteAccountButton: string;
  confirmDeleteAccount: string;
  deleteAccountError: string;
  notLoggedIn: string;
  deleteFailed: string;
  accountDeletedSuccessfully: string;
  usernameTaken: string; 
  usernameUpdateFailed: string; 
  usernameUpdateUnknownError: string; 
  usernameUpdatedSuccessfully: string; 
  pleaseSetUsername: string; // ★★★ 追加：ユーザー名設定を促すメッセージ ★★★
  enterUsername: string; // ★★★ 追加：ユーザー名入力フィールドのプレースホルダー ★★★
  zod_errors: ZodErrorTranslations;
  fetchScheduleError?: string;
  addScheduleFailed?: string;
  addScheduleSuccess?: string;
  addScheduleError?: string;
  deleteInvalid?: string;
  deleteScheduleFailed?: string;
  deleteScheduleSuccess?: string;
  deleteScheduleError?: string;
  notLoggedInAdd?: string;
}

// AppContextの型定義を拡張
interface AppContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  translations: Translations;
  selectedDate: dayjs.Dayjs;
  setSelectedDate: (date: dayjs.Dayjs) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const translationsData: Record<Language, Translations> = {
  ja: {
    settings: '設定',
    username: 'ユーザー名',
    following: 'フォロー中',
    followers: 'フォロワー',
    profileEdit: 'プロフィールを編集',
    languageSetting: '言語設定',
    darkMode: 'ダークモード',
    saveFailed: '設定の保存に失敗しました',
    add: '追加',
    cancel: 'キャンセル',
    addevent: '予定を追加',
    start: '開始時間',
    finish: '終了時間',
    content: '内容',
    friends: 'フレンド',
    world: 'ワールド',
    userserch: 'ユーザー検索',
    serch: '検索',
    user: '該当するユーザーはいません',
    follow: 'フォロー申請',
    followrequet: 'フォロー申請はありません',
    profile: 'プロフィールを見る',
    approval: '承認',
    rejection: '拒否',
    userprofile: 'ユーザープロフィール',
    unfollow: 'アンフォロー',
    wait: '承認待ち',
    followrequest: 'フォローリクエスト',
    approvalrequest: 'フォローを承認',
    Post: '投稿',
    Postconent: '投稿内容',
    Follower: 'フォロワー限定投稿',
    form: '投稿フォーム',
    delete: '削除',
    deletepost: '投稿を削除',
    repeat: 'この投稿を削除してもよろしいですか？この操作は取り消せません。',
    complete: '完了',
    save: '保存',
    contactUs: "お問い合わせ",
    contactUsDescription: "何かお困りですか？お気軽にお問い合わせください。",
    openContactForm: "お問い合わせフォームを開く",
    deleteAccount: "アカウント削除",
    deleteAccountWarning: "アカウントを削除すると、すべての関連データも削除され、元に戻すことはできません。",
    deleteAccountButton: "アカウントを削除する",
    confirmDeleteAccount: "本当にアカウントを削除してもよろしいですか？この操作は元に戻せません。",
    deleteAccountError: "アカウントIDが見つかりません。",
    notLoggedIn: "ログインしていません。",
    deleteFailed: "アカウントの削除に失敗しました。",
    accountDeletedSuccessfully: "アカウントが正常に削除されました。",
    usernameTaken: 'そのユーザー名はすでに使用されています。',
    usernameUpdateFailed: 'ユーザー名の更新に失敗しました。',
    usernameUpdateUnknownError: 'ユーザー名の更新中に不明なエラーが発生しました。',
    usernameUpdatedSuccessfully: 'ユーザー名が正常に更新されました！',
    pleaseSetUsername: '最初にユーザー名を設定してください。', // ★★★ 追加 ★★★
    enterUsername: 'ユーザー名を入力', // ★★★ 追加 ★★★
    zod_errors: {
      required: "このフィールドは必須です。",
      string_min: "{min}文字以上で入力してください。",
      string_max: "{max}文字以下で入力してください。",
      invalid_type: "不正な入力形式です。",
      invalid_string_email: "有効なメールアドレスを入力してください。",
      end_time_after_start_time: "終了時刻は開始時刻より後に設定してください。",
      content_or_time_required: "内容、開始時刻、終了時刻のいずれかは必須です。",
      too_small: "値が小さすぎます。",
      too_big: "値が大きすぎます。",
      invalid_date: "無効な日付形式です。",
      invalid_search_term: "有効な検索ワードを入力してください。",
      invalid_username_format: "ユーザー名は英数字とアンダースコアのみ使用できます。",
    },
    fetchScheduleError: 'スケジュール取得中にエラーが発生しました',
    addScheduleFailed: '予定の追加に失敗しました',
    addScheduleSuccess: '予定が追加されました。',
    addScheduleError: '予定の追加中にエラーが発生しました',
    deleteInvalid: '削除対象またはユーザー情報が不正です。',
    deleteScheduleFailed: '予定の削除に失敗しました',
    deleteScheduleSuccess: '予定が削除されました。',
    deleteScheduleError: '予定の削除中にエラーが発生しました',
    notLoggedInAdd: 'ユーザーがログインしていません。予定を投稿できません。',
  },
  en: {
    settings: 'Settings',
    username: 'Username',
    following: 'Following',
    followers: 'Followers',
    profileEdit: 'Edit Profile',
    languageSetting: 'Language Settings',
    darkMode: 'Dark Mode',
    saveFailed: 'Failed to save settings',
    add: 'Add',
    cancel: 'Cancel',
    addevent: 'Add Event',
    start: 'Start Time',
    finish: 'Finish Time',
    content: 'Content',
    friends: 'Friends',
    world: 'World',
    userserch: 'User Search',
    serch: 'Search',
    user: 'There are no matching users',
    follow: 'Follow request',
    followrequet: 'There are no follow requests',
    profile: 'View profile',
    approval: 'Approval',
    rejection: 'Rejection',
    userprofile: 'User Profile',
    unfollow: 'Unfollow',
    wait: 'Waiting for approval',
    followrequest: 'Follow Request',
    approvalrequest: 'Accept Follow',
    Post: 'Post',
    Postconent: 'Post Content',
    Follower: 'Follower-only posts',
    form: 'Submission form',
    delete: 'Delete',
    deletepost: 'Delete Post',
    repeat: 'Are you sure you want to delete this post? This action cannot be undone.',
    complete: 'Complete',
    save: 'Save',
    contactUs: "Contact Us",
    contactUsDescription: "Do you have any issues? Feel free to contact us.",
    openContactForm: "Open Contact Form",
    deleteAccount: "Delete Account",
    deleteAccountWarning: "Deleting your account will remove all associated data and cannot be undone.",
    deleteAccountButton: "Delete Account",
    confirmDeleteAccount: "Are you sure you want to delete your account? This action cannot be undone.",
    deleteAccountError: "Account ID not found.",
    notLoggedIn: "Not logged in.",
    deleteFailed: "Failed to delete account.",
    accountDeletedSuccessfully: "Account deleted successfully.",
    usernameTaken: 'That username is already taken.',
    usernameUpdateFailed: 'Failed to update username.',
    usernameUpdateUnknownError: 'An unknown error occurred while updating the username.',
    usernameUpdatedSuccessfully: 'Username updated successfully!',
    pleaseSetUsername: 'Please set your username first.', // ★★★ 追加 ★★★
    enterUsername: 'Enter username', // ★★★ 追加 ★★★
    zod_errors: {
      required: "This field is required.",
      string_min: "Must be at least {min} characters.",
      string_max: "Must be at most {max} characters.",
      invalid_type: "Invalid input type.",
      invalid_string_email: "Invalid email address.",
      end_time_after_start_time: "End time must be after start time.",
      content_or_time_required: "Content, start time, or end time is required.",
      too_small: "Value too small.",
      too_big: "Value too big.",
      invalid_date: "Invalid date format.",
      invalid_search_term: "Please enter a valid search term.",
      invalid_username_format: "Username can only contain alphanumeric characters and underscores.",
    },
    fetchScheduleError: 'Error fetching schedule',
    addScheduleFailed: 'Failed to add schedule',
    addScheduleSuccess: 'Schedule added successfully.',
    addScheduleError: 'Error adding schedule',
    deleteInvalid: 'Invalid deletion target or user info.',
    deleteScheduleFailed: 'Failed to delete schedule',
    deleteScheduleSuccess: 'Schedule deleted successfully.',
    deleteScheduleError: 'Error deleting schedule',
    notLoggedInAdd: 'User not logged in. Cannot post schedule.',
  },
  es: {
    settings: 'Configuraciones',
    username: 'Nombre de usuario',
    following: 'Siguiendo',
    followers: 'Seguidores',
    profileEdit: 'Editar perfil',
    languageSetting: 'Configuración de idioma',
    darkMode: 'Modo oscuro',
    saveFailed: 'Error al guardar la configuración',
    add: 'Agregar',
    cancel: 'Cancelar',
    addevent: 'Añadir evento',
    start: 'Hora de inicio',
    finish: 'Hora de finalización',
    content: 'Contenido',
    friends: 'Amigos',
    world: 'Mundo',
    userserch: 'Búsqueda de usuario',
    serch: 'Buscar',
    user: 'No hay usuarios coincidentes',
    follow: 'Solicitud de seguimiento',
    followrequet: 'No hay solicitudes de seguimiento',
    profile: 'Ver perfil',
    approval: 'Aprobación',
    rejection: 'Rechazo',
    userprofile: 'Perfil de usuario',
    unfollow: 'Dejar de seguir',
    wait: 'Esperando aprobación',
    followrequest: 'Solicitud de seguimiento',
    approvalrequest: 'Aceptar seguimiento',
    Post: 'Publicar',
    Postconent: 'Contenido de la publicación',
    Follower: 'Publicaciones solo para seguidores',
    form: 'Formulario de envío',
    delete: 'Eliminar',
    deletepost: 'Eliminar publicación',
    repeat: '¿Estás seguro de que quieres eliminar esta publicación? Esta acción no se puede deshacer.',
    complete: 'Completar',
    save: 'Guardar',
    contactUs: "Contáctenos",
    contactUsDescription: "¿Tiene algún problema? No dude en contactarnos.",
    openContactForm: "Abrir formulario de contacto",
    deleteAccount: "Eliminar cuenta",
    deleteAccountWarning: "Al eliminar su cuenta, se eliminarán todos los datos asociados y no se podrá deshacer.",
    deleteAccountButton: "Eliminar cuenta",
    confirmDeleteAccount: "¿Está seguro de que desea eliminar su cuenta? Esta acción no se puede deshacer.",
    deleteAccountError: "ID de cuenta no encontrado.",
    notLoggedIn: "No ha iniciado sesión.",
    deleteFailed: "Error al eliminar la cuenta.",
    accountDeletedSuccessfully: "Cuenta eliminada exitosamente.",
    usernameTaken: 'Ese nombre de usuario ya está en uso.',
    usernameUpdateFailed: 'Error al actualizar el nombre de usuario.',
    usernameUpdateUnknownError: 'Se produjo un error desconocido al actualizar el nombre de usuario.',
    usernameUpdatedSuccessfully: '¡Nombre de usuario actualizado correctamente!',
    pleaseSetUsername: 'Por favor, establece tu nombre de usuario primero.', // ★★★ 追加 ★★★
    enterUsername: 'Introduce nombre de usuario', // ★★★ 追加 ★★★
    zod_errors: {
      required: "Este campo es obligatorio.",
      string_min: "Debe tener al menos {min} caracteres.",
      string_max: "Debe tener como máximo {max} caracteres.",
      invalid_type: "Tipo de entrada inválido.",
      invalid_string_email: "Dirección de correo electrónico no válida.",
      end_time_after_start_time: "La hora de finalización debe ser posterior a la hora de inicio.",
      content_or_time_required: "Se requiere contenido, hora de inicio o hora de finalización.",
      too_small: "Valor demasiado pequeño.",
      too_big: "Valor demasiado grande.",
      invalid_date: "Formato de fecha inválido.",
      invalid_search_term: "Por favor, introduzca un término de búsqueda válido.",
      invalid_username_format: "El nombre de usuario solo puede contener caracteres alfanuméricos y guiones bajos.",
    },
    fetchScheduleError: 'Error al obtener el horario',
    addScheduleFailed: 'Error al agregar horario',
    addScheduleSuccess: 'Horario agregado exitosamente.',
    addScheduleError: 'Error al agregar horario',
    deleteInvalid: 'Objetivo de eliminación o información de usuario inválidos.',
    deleteScheduleFailed: 'Error al eliminar horario',
    deleteScheduleSuccess: 'Horario eliminado exitosamente.',
    deleteScheduleError: 'Error al eliminar horario',
    notLoggedInAdd: 'Usuario no ha iniciado sesión. No se puede publicar horario.',
  },
  fr: {
    settings: 'Paramètres',
    username: 'Nom d\'utilisateur',
    following: 'Abonnements',
    followers: 'Abonnés',
    profileEdit: 'Modifier le profil',
    languageSetting: 'Paramètres de langue',
    darkMode: 'Mode sombre',
    saveFailed: 'Échec de l\'enregistrement des paramètres',
    add: 'Ajouter',
    cancel: 'Annuler',
    addevent: 'Ajouter un événement',
    start: 'Heure de début',
    finish: 'Heure de fin',
    content: 'Contenu',
    friends: 'Amis',
    world: 'Monde',
    userserch: 'Recherche d\'utilisateur',
    serch: 'Rechercher',
    user: 'Aucun utilisateur correspondant',
    follow: 'Demande d\'abonnement',
    followrequet: 'Aucune demande d\'abonnement',
    profile: 'Voir le profil',
    approval: 'Approbation',
    rejection: 'Rejet',
    userprofile: 'Profil utilisateur',
    unfollow: 'Se désabonner',
    wait: 'En attente d\'approbation',
    followrequest: 'Demande d\'abonnement',
    approvalrequest: 'Accepter l\'abonnement',
    Post: 'Publier',
    Postconent: 'Contenu de la publication',
    Follower: 'Publications réservées aux abonnés',
    form: 'Formulaire de soumission',
    delete: 'Supprimer',
    deletepost: 'Supprimer la publication',
    repeat: 'Voulez-vous vraiment supprimer cette publication ? Cette action est irréversible.',
    complete: 'Terminé',
    save: 'Sauvegarder',
    contactUs: "Contactez-nous",
    contactUsDescription: "Avez-vous des problèmes ? N'hésitez pas à nous contacter.",
    openContactForm: "Ouvrir le formulaire de contact",
    deleteAccount: "Supprimer le compte",
    deleteAccountWarning: "La suppression de votre compte entraînera la suppression de toutes les données associées et ne pourra pas être annulée.",
    deleteAccountButton: "Supprimer le compte",
    confirmDeleteAccount: "Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.",
    deleteAccountError: "ID de compte introuvable.",
    notLoggedIn: "Non connecté.",
    deleteFailed: "Échec de la suppression du compte.",
    accountDeletedSuccessfully: "Compte supprimé avec succès.",
    usernameTaken: 'Ce nom d\'utilisateur est déjà pris.',
    usernameUpdateFailed: 'Échec de la mise à jour du nom d\'utilisateur.',
    usernameUpdateUnknownError: 'Une erreur inconnue est survenue lors de la mise à jour du nom d\'utilisateur.',
    usernameUpdatedSuccessfully: 'Nom d\'utilisateur mis à jour avec succès !',
    pleaseSetUsername: 'Veuillez d\'abord définir votre nom d\'utilisateur.', // ★★★ 追加 ★★★
    enterUsername: 'Entrez le nom d\'utilisateur', // ★★★ 追加 ★★★
    zod_errors: {
      required: "Ce champ est obligatoire.",
      string_min: "Doit contenir au moins {min} caractères.",
      string_max: "Doit contenir au plus {max} caractères.",
      invalid_type: "Type d'entrée invalide.",
      invalid_string_email: "Adresse e-mail non valide.",
      end_time_after_start_time: "L'heure de fin doit être postérieure à l'heure de début.",
      content_or_time_required: "Le contenu, l'heure de début ou l'heure de fin est requis.",
      too_small: "Valeur trop petite.",
      too_big: "Valeur trop grande.",
      invalid_date: "Format de date invalide.",
      invalid_search_term: "Veuillez saisir un terme de recherche valide.",
      invalid_username_format: "Le nom d'utilisateur ne peut contenir que des caractères alphanumériques et des underscores.",
    },
    fetchScheduleError: 'Erreur lors de la récupération de l\'emploi du temps',
    addScheduleFailed: 'Échec de l\'ajout de l\'emploi du temps',
    addScheduleSuccess: 'Emploi du temps ajouté avec succès.',
    addScheduleError: 'Erreur lors de l\'ajout de l\'emploi du temps',
    deleteInvalid: 'Cible de suppression ou informations utilisateur invalides.',
    deleteScheduleFailed: 'Échec de la suppression de l\'emploi du temps',
    deleteScheduleSuccess: 'Emploi du temps supprimé avec succès.',
    deleteScheduleError: 'Erreur lors de la suppression de l\'emploi du temps',
    notLoggedInAdd: 'Utilisateur non connecté. Impossible de publier l\'emploi du temps.',
  },
};

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('ja');
  const [isLoading, setIsLoading] = useState(true);

  const location = useLocation();
  const navigate = useNavigate();

  // URLとlocalStorageから日付を読み込むヘルパー関数
  const getDateFromUrlAndStorage = useCallback(() => {
    const params = new URLSearchParams(location.search);
    const dateParam = params.get('date');
    if (dateParam && dayjs(dateParam, 'YYYY-MM-DD', true).isValid()) {
      return dayjs(dateParam);
    }
    const storedDate = localStorage.getItem('lastSelectedDate');
    if (storedDate && dayjs(storedDate, 'YYYY-MM-DD', true).isValid()) {
      return dayjs(storedDate);
    }
    return dayjs(); // デフォルトは今日
  }, [location.search]);

  // selectedDateのローカル状態
  const [selectedDate, setSelectedDateState] = useState<dayjs.Dayjs>(getDateFromUrlAndStorage());

  // selectedDateを更新し、localStorageとURLクエリも同期する関数
  const setSelectedDate = useCallback((date: dayjs.Dayjs) => {
    setSelectedDateState(date); // コンテキストのselectedDateを更新
    const newDateStr = date.format('YYYY-MM-DD');
    localStorage.setItem('lastSelectedDate', newDateStr); // localStorageに保存

    // URLクエリパラメータを更新
    const params = new URLSearchParams(location.search);
    if (params.get('date') !== newDateStr) {
      params.set('date', newDateStr);
      // `replace: true` を使うことで履歴スタックに新しいエントリを追加せず、現在のURLを置き換える
      // これにより、ブラウザの「戻る」ボタンを押したときに意図しない履歴が残るのを防ぐ
      navigate(`?${params.toString()}`, { replace: true });
    }
  }, [location.search, navigate]);

  // アプリケーション起動時とURL変更時にselectedDateを同期
  useEffect(() => {
    const urlOrStoredDate = getDateFromUrlAndStorage();
    if (!urlOrStoredDate.isSame(selectedDate, 'day')) {
      setSelectedDate(urlOrStoredDate);
    }
  }, [location.search, getDateFromUrlAndStorage, selectedDate, setSelectedDate]);

  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          // console.log('ユーザーID:', authData.user.id); // デバッグ用
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('preferred_language')
            .eq('id', authData.user.id)
            .single();

          if (userProfile?.preferred_language) {
            setLanguage(userProfile.preferred_language as Language);
          }
        }
      } catch (error) {
        console.error('言語設定の読み込みに失敗しました:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserPreferences();
  }, []);

  const updateLanguage = async (newLang: Language) => {
    setLanguage(newLang);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        await supabase
          .from('user_profiles')
          .update({ preferred_language: newLang })
          .eq('id', authData.user.id);
      }
    } catch (error) {
      console.error('言語設定の保存に失敗しました:', error);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <AppContext.Provider value={{
      language,
      setLanguage: updateLanguage,
      translations: translationsData[language],
      selectedDate,
      setSelectedDate,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};

export default AppContext;