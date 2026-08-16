import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const generateLearnerCode = () => {
  return 'SL-' + Math.floor(100000 + Math.random() * 900000).toString();
};

// 1. REGISTER USER
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const learnerCode = role === 'LEARNER' ? generateLearnerCode() : null;

    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: role === 'PARENT' ? 'PARENT' : 'LEARNER',
        learnerCode
      }
    });

    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        learnerCode: newUser.learnerCode
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 2. LOGIN USER
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        learnerCode: user.learnerCode
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 3. LINK CHILD TO PARENT
router.post('/link-child', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'PARENT') {
      return res.status(403).json({ success: false, message: 'Only parents can link children' });
    }

    const { learnerCode } = req.body;
    if (!learnerCode) {
      return res.status(400).json({ success: false, message: 'Learner Code is required' });
    }

    const child = await prisma.user.findFirst({
      where: { learnerCode, role: 'LEARNER' }
    });

    if (!child) {
      return res.status(404).json({ success: false, message: 'Child with this code was not found' });
    }

    const existingLink = await prisma.parentChild.findUnique({
      where: {
        parentId_childId: {
          parentId: req.user.userId,
          childId: child.id
        }
      }
    });

    if (existingLink) {
      return res.status(400).json({ success: false, message: 'Child is already linked to your account' });
    }

    await prisma.parentChild.create({
      data: {
        parentId: req.user.userId,
        childId: child.id
      }
    });

    return res.json({
      success: true,
      message: `Successfully linked ${child.fullName} to your account!`,
      child: {
        id: child.id,
        fullName: child.fullName,
        email: child.email,
        learnerCode: child.learnerCode
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 4. GET ALL LINKED CHILDREN
router.get('/my-children', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'PARENT') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const childrenLinks = await prisma.parentChild.findMany({
      where: { parentId: req.user.userId },
      include: {
        child: {
          select: {
            id: true,
            fullName: true,
            email: true,
            learnerCode: true,
            sessions: {
              where: { isActive: true },
              take: 1
            },
            alerts: {
              take: 5,
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });

    const children = childrenLinks.map(link => ({
      ...link.child,
      isFocusActive: link.child.sessions.length > 0
    }));

    return res.json({ success: true, children });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;