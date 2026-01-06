export const emailTemplate = (otp: string | number): string => `
  <div style="font-family: Helvetica, Arial, sans-serif; min-width: 1000px; overflow: auto; line-height: 2;">
    <div style="margin: 50px auto; width: 70%; padding: 20px 0;">
      <div style="border-bottom: 1px solid #eee;">
        <a href="#" style="font-size: 1.4em; color: #00466a; text-decoration: none; font-weight: 600;">Telugu Association</a>
      </div>
      <p style="font-size: 1.1em;">Hi,</p>
      <p>Use the following OTP to complete your change password.</p>
      <h2 style="background: #00466a; margin: 0 auto; width: max-content; padding: 0 10px; color: #fff; border-radius: 4px;">${otp}</h2>
      <hr style="border: none; border-top: 1px solid #eee;" />
      
    </div>
  </div>
`;

export const welcomeEmailTemplate = (email: string, password: string): string => `
  <div style="font-family: Helvetica, Arial, sans-serif; min-width: 1000px; overflow: auto; line-height: 2;">
    <div style="margin: 50px auto; width: 70%; padding: 20px 0;">
      <div style="border-bottom: 1px solid #eee;">
        <a href="#" style="font-size: 1.4em; color: #00466a; text-decoration: none; font-weight: 600;">Telugu Association</a>
      </div>
      <p style="font-size: 1.1em;">Hi,</p>
      <p>Welcome to Telugu Association! Your account has been created successfully.</p>
      <p>Here are your login credentials:</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Password:</strong> ${password}</p>
      <p>Please login and change your password immediately.</p>
      <hr style="border: none; border-top: 1px solid #eee;" />
    </div>
  </div>
`;
