import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const requiredFirebaseKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

export const allowedEmails = (import.meta.env.VITE_ALLOWED_EMAILS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

export const isFirebaseConfigured = requiredFirebaseKeys.length === 0

let authInstance = null
let googleProvider = null

function ensureAuth() {
  if (!isFirebaseConfigured) {
    throw new Error(`Faltan variables de Firebase: ${requiredFirebaseKeys.join(', ')}`)
  }

  if (!authInstance) {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
    authInstance = getAuth(app)
    googleProvider = new GoogleAuthProvider()
  }

  return { auth: authInstance, provider: googleProvider }
}

export function subscribeToGoogleAuth(callback) {
  if (!isFirebaseConfigured) {
    callback(null)
    return () => {}
  }

  const { auth } = ensureAuth()
  return onAuthStateChanged(auth, callback)
}

export async function signInWithGoogle() {
  const { auth, provider } = ensureAuth()
  const result = await signInWithPopup(auth, provider)
  return result.user
}

export async function logoutFromGoogle() {
  if (!isFirebaseConfigured) return
  const { auth } = ensureAuth()
  await signOut(auth)
}

export function isAllowedEmail(email) {
  if (!email) return false
  if (!allowedEmails.length) return false
  return allowedEmails.includes(email.trim().toLowerCase())
}
