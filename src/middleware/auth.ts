import { NextFunction, Request, Response } from "express";
import { auth } from "express-oauth2-jwt-bearer";
import jwt from "jsonwebtoken";
import User from "../models/user";

//* Porción de código que agrega los nuevos valores a la interface Request de Express
//* Esto es necesario de realizar en typescript, ya que si no lo hacemos, typescript tirará error porque al ser un lenguaje tipado, espera que determinemos cada uno de los elementos de un objeto, en este caso del objeto Request que pertenece a Express.
declare global {
  namespace Express {
    interface Request {
      userId: string;
      auth0Id: string;
    }
  }
}

//! Esta función valida que el token que llega proviene de AUTH0.
export const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: "RS256",
});

//! Esta función decodifica el token que llega, obtiene ID de mongo y de AUTH0 del usuario y los agrega al objeto Request de express.
export const jwtParse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  //* Se obtiene el encabezado de autorización de los encabezados(headers)
  const { authorization } = req.headers;

  //* Se verifica si existe y si comienza con Bearer (La convención de JsonWebToken)
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.sendStatus(401);
  }

  //* Se obtiene el token (Ya que los token jwt comienzan con Bearer aljskndaañlsdnka)
  const token = authorization.split(" ")[1];

  try {
    //* Se decodifica el token para obtener los datos del usuario cuya sesión está activa.
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    //* Se toma el id de auth0 con el .sub (En el mundo de auth0 el .sub contiene el auth0Id)
    const auth0Id = decoded.sub;

    //* Se obtiene el usuario de la bdd
    const user = await User.findOne({ auth0Id });

    //* Si no se encuentra se devuelve un error (No autorizado)
    if (!user) {
      return res.sendStatus(401);
    }

    //* Se agregan los valores de auth0Id(auth0) y de userId(mongo) a la request
    //* Para eso es necesario agregarlo al objeto global request ya que typescript asi lo requiere.
    req.auth0Id = auth0Id as string; //? Aclaramos que sea de tipo string sino da error de typescript porque interpreta que también puede ser undefined
    req.userId = user._id.toString(); //? En este caso no porque lo estamos convirtiendo a string por lo tanto siempre sera un string.

    //* Finaliza el middleware y se continua con la siguiente etapa de la petición.
    next();
  } catch (error) {
    res.sendStatus(401);
  }
};
