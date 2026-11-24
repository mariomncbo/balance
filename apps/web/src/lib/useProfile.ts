import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface Profile {
  name: string;
  username: string;
  email: string;
}
let cache: Profile | null = null;

/** Perfil del usuario (nombre, usuario y correo: lo único que no va cifrado). Se pide una vez. */
export function useProfile(): Profile | null {
  const [profile, setProfile] = useState<Profile | null>(cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    void supabase
      .from("profiles")
      .select("name, username, email")
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        cache = data as Profile;
        setProfile(cache);
      });
    return () => {
      alive = false;
    };
  }, []);
  return profile;
}

export const clearProfileCache = () => {
  cache = null;
};
