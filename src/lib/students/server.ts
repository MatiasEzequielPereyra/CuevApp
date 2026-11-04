import { productConfig, userClient } from "@/lib/product-auth/server";
export async function studentAdmin() {
 if (!productConfig()) return null;
 const client = await userClient(true);
 const {data:{user},error} = await client.auth.getUser();
 if(error || !user) return null;
 const profile = await client.from("cueva_profiles").select("role").maybeSingle();
 return !profile.error && profile.data?.role === "admin" ? client : null;
}
