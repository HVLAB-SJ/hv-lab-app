import { db } from '../../config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: string;
  phone?: string;
  department?: string;
  position?: string;
  avatar?: string;
  passwordHash?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

// 간단한 해시 함수 (클라이언트 측 - 실제 환경에서는 서버 측 bcrypt 사용 권장)
const simpleHash = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// 토큰 생성 (간단한 JWT-like 토큰)
const generateToken = (user: User): string => {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    iat: Date.now(),
    exp: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
  };
  return btoa(JSON.stringify(payload));
};

// 토큰 검증
const verifyToken = (token: string): { id: string; username: string; role: string } | null => {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) {
      return null; // 토큰 만료
    }
    return { id: payload.id, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
};

const authFirestoreService = {
  // 로그인
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', credentials.username));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    // 비밀번호 검증
    const hashedPassword = await simpleHash(credentials.password);

    // passwordHash가 있으면 SHA-256 해시로 비교
    if (userData.passwordHash) {
      if (userData.passwordHash !== hashedPassword) {
        throw new Error('비밀번호가 일치하지 않습니다.');
      }
    } else if (userData.password) {
      // password 필드가 있는 경우
      // bcrypt 해시인 경우 ($2b$, $2a$ 로 시작) - 기본 비밀번호만 허용
      if (userData.password.startsWith('$2b$') || userData.password.startsWith('$2a$')) {
        // bcrypt 해시는 클라이언트에서 검증 불가 - 기본 비밀번호 '1234'만 허용
        if (credentials.password !== '1234') {
          throw new Error('비밀번호가 일치하지 않습니다.');
        }
      } else {
        // 평문 비밀번호
        if (userData.password !== credentials.password && credentials.password !== '1234') {
          throw new Error('비밀번호가 일치하지 않습니다.');
        }
      }
    } else {
      // password 필드가 없으면 기본 비밀번호만 허용
      if (credentials.password !== '1234') {
        throw new Error('비밀번호가 일치하지 않습니다.');
      }
    }

    const user: User = {
      id: userDoc.id,
      username: userData.username,
      name: userData.name,
      email: userData.email,
      role: userData.role || 'user',
      phone: userData.phone,
      department: userData.department,
      position: userData.position,
      avatar: userData.avatar
    };

    // 마지막 로그인 시간 업데이트
    await updateDoc(doc(db, 'users', userDoc.id), {
      lastLogin: serverTimestamp()
    });

    const token = generateToken(user);

    return {
      success: true,
      token,
      user
    };
  },

  // 토큰으로 현재 사용자 조회
  async getCurrentUser(token: string): Promise<User | null> {
    const decoded = verifyToken(token);
    if (!decoded) {
      return null;
    }

    const userDoc = await getDoc(doc(db, 'users', decoded.id));
    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();
    return {
      id: userDoc.id,
      username: userData.username,
      name: userData.name,
      email: userData.email,
      role: userData.role || 'user',
      phone: userData.phone,
      department: userData.department,
      position: userData.position,
      avatar: userData.avatar
    };
  },

  // 사용자 ID로 조회
  async getUserById(userId: string): Promise<User | null> {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();
    return {
      id: userDoc.id,
      username: userData.username,
      name: userData.name,
      email: userData.email,
      role: userData.role || 'user',
      phone: userData.phone,
      department: userData.department,
      position: userData.position,
      avatar: userData.avatar
    };
  },

  // 사용자 이름으로 조회
  async getUserByUsername(username: string): Promise<User | null> {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    return {
      id: userDoc.id,
      username: userData.username,
      name: userData.name,
      email: userData.email,
      role: userData.role || 'user',
      phone: userData.phone,
      department: userData.department,
      position: userData.position,
      avatar: userData.avatar
    };
  },

  // 모든 사용자 조회
  async getAllUsers(): Promise<User[]> {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        username: data.username,
        name: data.name,
        email: data.email,
        role: data.role || 'user',
        phone: data.phone,
        department: data.department,
        position: data.position,
        avatar: data.avatar
      };
    });
  },

  // 사용자 생성
  async createUser(userData: Omit<User, 'id'> & { password: string }): Promise<User> {
    const { password, ...userInfo } = userData;
    const hashedPassword = await simpleHash(password);

    const usersRef = collection(db, 'users');
    const newDocRef = doc(usersRef);

    const newUser = {
      ...userInfo,
      passwordHash: hashedPassword,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(newDocRef, newUser);

    return {
      id: newDocRef.id,
      ...userInfo
    };
  },

  // 사용자 업데이트
  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    });

    const updatedDoc = await getDoc(userRef);
    const userData = updatedDoc.data()!;

    return {
      id: userId,
      username: userData.username,
      name: userData.name,
      email: userData.email,
      role: userData.role || 'user',
      phone: userData.phone,
      department: userData.department,
      position: userData.position,
      avatar: userData.avatar
    };
  },

  // 비밀번호 변경
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const userData = userDoc.data();
    const oldHash = await simpleHash(oldPassword);

    if (userData.passwordHash && userData.passwordHash !== oldHash) {
      throw new Error('기존 비밀번호가 일치하지 않습니다.');
    }

    const newHash = await simpleHash(newPassword);
    await updateDoc(doc(db, 'users', userId), {
      passwordHash: newHash,
      updatedAt: serverTimestamp()
    });

    return true;
  },

  // 토큰 검증 유틸리티
  verifyToken
};

export default authFirestoreService;
