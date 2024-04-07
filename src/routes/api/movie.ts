import { Hono } from "hono";
import { z } from "zod";
import { buildClient } from "$db/db";
import { moviesTable, movieSchema, Movie } from "$db/schema";
import { eq } from "drizzle-orm";
import { Env } from "$lib/env";
import { getMovieRuntime } from "$lib/tmdb";

const movie = new Hono<{ Bindings: Env }>();

movie.get("/:tmdb", async (c) => {
  let tmdb_id: number;
  if (!c.req.param("tmdb")) {
    return c.json({ message: "No TMDB id provided." }, 400);
  }

  try {
    tmdb_id = await z.coerce.number().parseAsync(c.req.param("tmdb"));
  } catch (e) {
    return c.json({ message: "Invalid TMDB id." }, 400);
  }

  const db = buildClient(c.env);

  const res = await db
    .select({
      outro_start: moviesTable.outro_start,
    })
    .from(moviesTable)
    .where(eq(moviesTable.tmdb_id, tmdb_id));

  if (res.length === 0) {
    return c.json({ message: "No results found." }, 404);
  }

  return c.json({ tmdb_id: tmdb_id, outro_start: res[0].outro_start });
});

movie.post("/", async (c) => {
  let body: Movie;

  if (c.req.header("Authorization") !== c.env.AUTH_KEY) {
    return c.text("", 401);
  }

  try {
    body = movieSchema.parse(await c.req.json());
  } catch (e) {
    return c.json({ message: "Invalid body." }, 400);
  }

  if (
    body.outro_start > (await getMovieRuntime(body.tmdb_id, c.env.TMDB_API_KEY))
  ) {
    return c.json({ message: "Invalid outro_start time." }, 400);
  }

  const db = buildClient(c.env);

  const res = await db
    .insert(moviesTable)
    .values({
      ...body,
    })
    .onConflictDoNothing();

  if (res.rowsAffected === 0) {
    return c.json({ message: "No rows affected." }, 409);
  }

  return c.json({ message: "OK!" });
});

movie.patch("/", async (c) => {
  let body: Movie;

  if (c.req.header("Authorization") !== c.env.AUTH_KEY) {
    return c.text("", 401);
  }

  try {
    body = movieSchema.parse(await c.req.json());
  } catch (e) {
    return c.json({ message: "Invalid body." }, 400);
  }

  if (
    body.outro_start > (await getMovieRuntime(body.tmdb_id, c.env.TMDB_API_KEY))
  ) {
    return c.json({ message: "Invalid outro_start time." }, 400);
  }

  const db = buildClient(c.env);

  const res = await db
    .update(moviesTable)
    .set({ outro_start: body.outro_start })
    .where(eq(moviesTable.tmdb_id, body.tmdb_id));

  if (res.rowsAffected === 0) {
    return c.json({ message: "No rows affected." }, 409);
  }

  return c.json({ message: "OK!" });
});

movie.delete("/:tmdb", async (c) => {
  let tmdb_id: number;
  if (!c.req.param("tmdb")) {
    return c.json({ message: "No TMDB id provided." }, 400);
  }

  try {
    tmdb_id = await z.coerce.number().parseAsync(c.req.param("tmdb"));
  } catch (e) {
    return c.json({ message: "Invalid TMDB id." }, 400);
  }

  if (c.req.header("Authorization") !== c.env.AUTH_KEY) {
    return c.text("", 401);
  }

  const db = buildClient(c.env);

  const res = await db
    .delete(moviesTable)
    .where(eq(moviesTable.tmdb_id, tmdb_id));

  if (res.rowsAffected === 0) {
    return c.json({ message: "No rows affected." }, 404);
  }

  return c.json({ message: "OK!" });
});

movie.options("/", async (c) => {
  c.res.headers.set("Allow", "GET, POST, PATCH, DELETE, OPTIONS");
  return c.text("", 204);
});

export default movie;
