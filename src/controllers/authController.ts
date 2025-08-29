import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import nodemailer from 'nodemailer';
import { EmailHelper } from '../utils/emailHelper';
import SchemaManagementService from '../services/SchemaManagementService';
import juice from 'juice';


const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

// List all valid client IDs for verification of Google ID tokens
const validGoogleClientIds = [
  process.env.GOOGLE_WEB_CLIENT_ID,
  process.env.GOOGLE_IOS_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
].filter(Boolean) as string[];

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const schemaService = SchemaManagementService.getInstance();

export const createUserController = async (req: Request, res: Response) => {
  try {
    const {
      organizationName,
      email,
      password,
      firstName,
      lastName,
      phone,
      role,
      employeeCode,
      city,
      state
    } = req.body;

    console.log("Create user request received");
    console.log("Request body:", req.body);

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    console.log("Image path:", imagePath);

    // Validate required fields
    // if (!organizationName || !email || !password || !role || !firstName) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "organizationName, email, password, role, firstName are required"
    //   });
    // }

    // Find organization
    const org = await schemaService.sharedDb.organization.findUnique({
      where: {
        name: organizationName
      },
      select: {
        id: true,
        schemaName: true,
        name: true
      }
    });

    if (!org) {
      return res.status(400).json({
        success: false,
        message: "Organization doesn't exist, please create one first"
      });
    }

    // // Check if user already exists in shared database
    // const existingUser = await schemaService.sharedDb.user.findUnique({
    //   where: { email }
    // });

    // if (existingUser) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "User with this email already exists"
    //   });
    // }

    // // Get tenant database
    // const schemaName = org.schemaName;
    // if (!schemaName) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "create schema for this organization"
    //   });
    // }
    // const tenantDb = await schemaService.getTenantClient(schemaName);

    // // Hash password
    // const hashedPassword = await bcrypt.hash(password, 10);

    // // Create user in shared database (inactive by default)
    // const newUser = await schemaService.sharedDb.user.create({
    //   data: {
    //     organizationId: org.id,
    //     email,
    //     password: hashedPassword,
    //     role,
    //     isActive: false,
    //   }
    // });

    // // Create employee in tenant database
    // const newEmployee = await tenantDb.employee.create({
    //   data: {
    //     organizationId: org.id,
    //     email,
    //     passwordHash: hashedPassword,
    //     firstName,
    //     lastName,
    //     phone,
    //     role,
    //     employeeCode,
    //     city,
    //     state,
    //     isActive: false,
    //     profilePic: imagePath,
    //   }
    // });

    // Generate activation link (simple link with email parameter)
    const activationLink = `${process.env.FRONTEND_URL}/activate-account?email=${encodeURIComponent(email)}`;

    const htmlContent = await EmailHelper.loadActivationTemplate({
      userName: firstName + (lastName ? ` ${lastName}` : ''),
      userEmail: email,
      userDepartment: org.name, // or any department field
      userRole: role,
      resetUrl: activationLink,
      companyName: process.env.APP_NAME || 'ForPharma'
    });

    const inlinedHtmlContent = juice(htmlContent, {
      applyStyleTags: true,
      removeStyleTags: false,
      preserveFontFaces: true,
      inlinePseudoElements: true,
      webResources: {
        images: false, // Don't inline images
        svgs: false,
        links: false,
        scripts: false
      }
    });

    // // Email template
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'ForPharma'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome! Set Your Password',
      html: inlinedHtmlContent,
      text: `[Plain text version for fallback]`
    };


    // // Send email
    await transporter.sendMail(mailOptions);

    return res.status(201).json({
      success: true,
      message: "User created successfully. Please check your email to activate your account.",
      // user: {
      //   id: newUser.id,
      //   email: newUser.email,
      //   role: newUser.role,
      //   isActive: newUser.isActive
      // }
    });

  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  } finally {
    await schemaService.sharedDb.$disconnect();
  }
};

// Simple activation controller
export const activateAccountController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    console.log("Activate account request received");
    console.log("Request body:", email, password);
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email, password are required"
      });
    }

    // Find user in shared database
    const user = await schemaService.sharedDb.user.findUnique({
      where: { email },
      include: {
        organization: true
      }
    });

    console.log("User found:", user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.isActive) {
      return res.status(400).json({
        success: false,
        message: "Account is already activated"
      });
    }

    // Activate user in shared database
    await schemaService.sharedDb.user.update({
      where: { id: user.id },
      data: {
        isActive: true,
        lastLoginAt: new Date()
      }
    });

    // Activate employee in tenant database
    const schemaName = user.organization.schemaName;
    if (!schemaName) {
      return res.status(400).json({
        status: false,
        message: "Create schema for this organization"
      })
    }
    const tenantDb = await schemaService.getTenantClient(schemaName);
    await tenantDb.employee.update({
      where: { email },
      data: {
        isActive: true
      }
    });

    return res.status(200).json({
      success: true,
      message: "Account activated successfully. You can now login."
    });

  } catch (error) {
    console.error('Activate account error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to activate account"
    });
  } finally {
    await schemaService.sharedDb.$disconnect();
  }
};

export const loginController = async (req: Request, res: Response) => {
  try {
    console.log("login request received");
    const { email, password } = req.body;
    console.log(email);
    console.log(password);
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find employee in shared database
    const employee = await schemaService.sharedDb.user.findUnique({
      where: { email },
      include: {
        organization: true,
      },
    });
    console.log("employee find");
    console.log("Employee result:", employee);

    if (!employee) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!employee.isActive) {
      return res.status(403).json({ error: 'Account is not activated. Please check your email.' });
    }

    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, employee.password);
    // console.log("password validates");

    if (!isValidPassword) {
      console.log("invalid credentials");
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!employee.organization?.isActive) {
      return res.status(403).json({ error: 'Organization is not active' });
    }
    console.log("creating token");

    // Generate JWT token
    const token = jwt.sign(
      {
        id: employee.id,
        email: employee.email,
        organizationId: employee.organizationId,
        role: employee.role,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
    console.log(token);

    // Update last login timestamp
    await schemaService.sharedDb.user.update({
      where: { id: employee.id },
      data: { lastLoginAt: new Date() },
    });
    console.log("returning response to frontend");

    res.json({
      token,
      user: {
        id: employee.id,
        email: employee.email,
        role: employee.role,
        organization: {
          id: employee.organization.id,
          name: employee.organization.name,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  } finally {
    await schemaService.sharedDb.$disconnect();
  }
};

export const googleLoginController = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: validGoogleClientIds,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const email = payload.email;

    // Find employee by email
    const employee = await schemaService.sharedDb.user.findUnique({
      where: { email },
      include: {
        organization: true,
      },
    });

    if (!employee) {
      // Optionally create employee here or reject the login
      return res.status(401).json({ error: 'No user found with this Google account' });
    }

    if (!employee.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    if (!employee.organization?.isActive) {
      return res.status(403).json({ error: 'Organization is not active' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: employee.id,
        email: employee.email,
        organizationId: employee.organizationId,
        role: employee.role,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Update last login timestamp
    await schemaService.sharedDb.user.update({
      where: { id: employee.id },
      data: { lastLoginAt: new Date() },
    });

    res.json({
      token,
      user: {
        id: employee.id,
        email: employee.email,
        role: employee.role,
        organization: {
          id: employee.organization.id,
          name: employee.organization.name,
        },
      },
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ error: 'Google login failed' });
  } finally {
    await schemaService.sharedDb.$disconnect();
  }
};

export const fetchUsersController = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;
    console.log("Fetch users request received for organizationId:", organizationId);

    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId is required' });
    }

    // First, fetch the organization to get the schema name
    const organization = await schemaService.sharedDb.organization.findUnique({
      where: { id: String(organizationId) },
      select: { schemaName: true }
    });

    if (!organization || !organization.schemaName) {
      return res.status(404).json({ error: 'Organization not found or schema not set' });
    }

    // Get tenant DB client
    const tenantDb = await schemaService.getTenantClient(organization.schemaName);

    // Fetch users from tenant schema
    const employees = await tenantDb.employee.findMany();

    // Map to required format
    const users = employees.map(emp => ({
      id: emp.id,
      email: emp.email,
      firstName: emp.firstName,
      lastName: emp.lastName,
      roles: emp.role,
      createdAt: emp.createdAt,
      isActive: emp.isActive
    }));

    res.json(users);
  } catch (error) {
    console.error('Fetch users details error:', error);
    res.status(500).json({ error: 'Failed to fetch users details' });
  } finally {
    await schemaService.sharedDb.$disconnect();
  }
}
