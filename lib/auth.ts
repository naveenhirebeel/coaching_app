import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET!
const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_SECRET || JWT_SECRET

export function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function signSuperAdminToken() {
  return jwt.sign({ role: 'super_admin' }, SUPER_ADMIN_SECRET, { expiresIn: '12h' })
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; role: string; institute_id: string }
  } catch {
    return null
  }
}

export function verifySuperAdminToken(token: string) {
  try {
    const payload = jwt.verify(token, SUPER_ADMIN_SECRET) as { role: string }
    return payload.role === 'super_admin' ? payload : null
  } catch {
    return null
  }
}

export function getTokenFromRequest(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.split(' ')[1]
}

export function getAuthUser(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return null
  return verifyToken(token)
}

export function getSuperAdminUser(req: NextRequest) {
  const token = getTokenFromRequest(req)
  if (!token) return null
  return verifySuperAdminToken(token)
}
