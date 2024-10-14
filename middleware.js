import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const auth = async (req, res, next) => {
  const token = req.body.token;
  if (!token) {
    return res.status(400).send({ error: "Token is required" });
  }
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email, sub } = ticket.getPayload();
    
    // Optionally, you can set the user info on the request object
    req.user = { email, id: sub };
    
    // Call the next middleware or route handler
    next();
  } catch (error) {
    res.status(401).send({ error: "Invalid token" });
  }
};
