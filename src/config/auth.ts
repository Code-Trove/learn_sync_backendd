import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as TwitterStrategy } from "passport-twitter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import request from "request";

const prisma = new PrismaClient();

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          return done(null, false, { message: "Incorrect email." });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
          return done(null, false, { message: "Incorrect password." });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.use(
  new TwitterStrategy(
    {
      consumerKey: process.env.TWITTER_CONSUMER_KEY!,
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET!,
      callbackURL:
        "https://pfhfekecgdbgebmmnbnmgjimbaklkeko.chromiumapp.org/auth/twitter/callback",
    },
    async (token, tokenSecret, profile, done) => {
      try {
        let user = await prisma.user.findUnique({
          where: { twitterId: profile.id },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              twitterId: profile.id,
              name: profile.displayName,
              twitterToken: token,
              twitterSecret: tokenSecret,
              password: await bcrypt.hash("defaultPassword", 10), // Provide a default password
            },
          });
        } else {
          // Update the user's token and tokenSecret if they already exist
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              twitterToken: token,
              twitterSecret: tokenSecret,
            },
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);
