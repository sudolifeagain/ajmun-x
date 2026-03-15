import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";

export default async function StaffLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getSession();

    if (!user || user.primaryAttribute !== "staff") {
        redirect("/");
    }

    return <>{children}</>;
}
