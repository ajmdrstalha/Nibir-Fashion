import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Save, Shield, UserCog } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

type ManagedUser = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
};

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
  active: boolean;
};

const defaultUserForm: UserForm = {
  name: "",
  email: "",
  password: "",
  role: "user",
  active: true,
};

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [userForm, setUserForm] = useState<UserForm>(defaultUserForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [resetPasswords, setResetPasswords] = useState<Record<number, string>>({});

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => customFetch<ManagedUser[]>("/api/users"),
    enabled: isAdmin,
  });
  const managedUsers = (usersQuery.data ?? []) as ManagedUser[];

  const changePassword = useMutation({
    mutationFn: () => customFetch<{ ok: boolean }>("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(passwordForm),
    }),
    onSuccess: () => {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({ title: "Password changed", description: "Your password was updated successfully." });
    },
    onError: (error) => {
      toast({ title: "Password change failed", description: messageFrom(error, "Could not change password."), variant: "destructive" });
    },
  });

  const saveUser = useMutation({
    mutationFn: () => {
      if (editingId !== null) {
        return customFetch<ManagedUser>(`/api/users/${editingId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: userForm.name,
            email: userForm.email,
            role: userForm.role,
            active: userForm.active,
          }),
        });
      }

      return customFetch<ManagedUser>("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(userForm),
      });
    },
    onSuccess: async () => {
      setEditingId(null);
      setUserForm(defaultUserForm);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: editingId !== null ? "User updated" : "User created" });
    },
    onError: (error) => {
      toast({ title: "User save failed", description: messageFrom(error, "Could not save user."), variant: "destructive" });
    },
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => customFetch<{ ok: boolean }>(`/api/users/${id}/password`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }),
    onSuccess: async (_data, vars) => {
      setResetPasswords(current => ({ ...current, [vars.id]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Staff password updated" });
    },
    onError: (error) => {
      toast({ title: "Password reset failed", description: messageFrom(error, "Could not update staff password."), variant: "destructive" });
    },
  });

  const setActiveStatus = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => customFetch<ManagedUser>(`/api/users/${id}/${active ? "enable" : "disable"}`, {
      method: "PATCH",
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "User status updated" });
    },
    onError: (error) => {
      toast({ title: "Status update failed", description: messageFrom(error, "Could not update user status."), variant: "destructive" });
    },
  });

  function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordForm.newPassword.length < 8) {
      toast({ title: "Password too short", description: "New password must be at least 8 characters.", variant: "destructive" });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Passwords do not match", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }

    changePassword.mutate();
  }

  function startEdit(managedUser: ManagedUser) {
    setEditingId(managedUser.id);
    setUserForm({
      name: managedUser.name,
      email: managedUser.email,
      password: "",
      role: managedUser.role,
      active: managedUser.active,
    });
  }

  function submitUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userForm.name.trim() || !userForm.email.trim()) {
      toast({ title: "Missing user details", description: "Name and email are required.", variant: "destructive" });
      return;
    }

    if (editingId === null && userForm.password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }

    saveUser.mutate();
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <section className="bg-card border border-card-border rounded-2xl shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[hsl(45,65%,52%)] flex items-center justify-center">
            <Shield className="w-5 h-5 text-black" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Profile</h2>
            <p className="text-sm text-muted-foreground">Logged-in account details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="text-sm font-semibold text-foreground break-words">{user?.name}</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="text-sm font-semibold text-foreground break-words">{user?.email}</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">Role</p>
            <p className="text-sm font-semibold text-foreground capitalize">{user?.role}</p>
          </div>
        </div>
      </section>

      <section className="bg-card border border-card-border rounded-2xl shadow-sm p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <KeyRound className="w-5 h-5 text-[hsl(45,65%,52%)]" />
          <h2 className="text-base font-bold text-foreground">Change Password</h2>
        </div>

        <form onSubmit={submitPassword} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input id="current-password" type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} autoComplete="current-password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input id="new-password" type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} autoComplete="new-password" minLength={8} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input id="confirm-password" type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} autoComplete="new-password" minLength={8} required />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={changePassword.isPending} className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              {changePassword.isPending ? "Saving..." : "Update Password"}
            </Button>
          </div>
        </form>
      </section>

      {isAdmin && (
        <section className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-3">
            <UserCog className="w-5 h-5 text-[hsl(45,65%,52%)]" />
            <div>
              <h2 className="text-base font-bold text-foreground">User Management</h2>
              <p className="text-sm text-muted-foreground">Create staff accounts and manage access</p>
            </div>
          </div>

          <form onSubmit={submitUser} className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 border-b border-border">
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="staff-name">Name</Label>
              <Input id="staff-name" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} placeholder="Staff name" required />
            </div>
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input id="staff-email" type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} placeholder="staff@example.com" required />
            </div>
            {editingId === null && (
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="staff-password">Password</Label>
                <Input id="staff-password" type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} minLength={8} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="staff-role">Role</Label>
              <select id="staff-role" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value as UserForm["role"] })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <label className="flex items-center gap-2 h-10 mt-0 md:mt-8 text-sm font-medium text-foreground">
              <input type="checkbox" checked={userForm.active} onChange={e => setUserForm({ ...userForm, active: e.target.checked })} className="h-4 w-4" />
              Active
            </label>
            <div className="flex flex-col sm:flex-row gap-2 md:mt-8 xl:col-span-2">
              <Button type="submit" disabled={saveUser.isPending} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                {saveUser.isPending ? "Saving..." : editingId !== null ? "Save User" : "Create User"}
              </Button>
              {editingId !== null && (
                <Button type="button" variant="outline" onClick={() => { setEditingId(null); setUserForm(defaultUserForm); }} className="w-full sm:w-auto">
                  Cancel
                </Button>
              )}
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="hidden lg:table w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Name", "Email", "Role", "Status", "Reset Password", "Actions"].map(header => (
                    <th key={header} className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usersQuery.isLoading ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">Loading users...</td></tr>
                ) : managedUsers.map((managedUser: ManagedUser) => (
                  <tr key={managedUser.id} className="border-b border-border/60">
                    <td className="px-5 py-3 text-sm font-semibold text-foreground">{managedUser.name}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{managedUser.email}</td>
                    <td className="px-5 py-3 text-sm capitalize text-foreground">{managedUser.role}</td>
                    <td className="px-5 py-3 text-sm">{managedUser.active ? "Active" : "Inactive"}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <Input type="password" value={resetPasswords[managedUser.id] ?? ""} onChange={e => setResetPasswords(current => ({ ...current, [managedUser.id]: e.target.value }))} placeholder="New password" className="h-9 w-40" />
                        <Button type="button" size="sm" variant="outline" disabled={(resetPasswords[managedUser.id] ?? "").length < 8 || resetPassword.isPending} onClick={() => resetPassword.mutate({ id: managedUser.id, password: resetPasswords[managedUser.id] ?? "" })}>Reset</Button>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => startEdit(managedUser)}>Edit</Button>
                        <Button type="button" size="sm" variant={managedUser.active ? "destructive" : "outline"} disabled={setActiveStatus.isPending} onClick={() => setActiveStatus.mutate({ id: managedUser.id, active: !managedUser.active })}>
                          {managedUser.active ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="lg:hidden divide-y divide-border">
              {usersQuery.isLoading ? (
                <div className="p-5 text-center text-sm text-muted-foreground">Loading users...</div>
              ) : managedUsers.map((managedUser: ManagedUser) => (
                <div key={managedUser.id} className="p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{managedUser.name}</p>
                    <p className="text-xs text-muted-foreground break-words">{managedUser.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{managedUser.role} / {managedUser.active ? "Active" : "Inactive"}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input type="password" value={resetPasswords[managedUser.id] ?? ""} onChange={e => setResetPasswords(current => ({ ...current, [managedUser.id]: e.target.value }))} placeholder="New password" className="h-9" />
                    <Button type="button" size="sm" variant="outline" disabled={(resetPasswords[managedUser.id] ?? "").length < 8 || resetPassword.isPending} onClick={() => resetPassword.mutate({ id: managedUser.id, password: resetPasswords[managedUser.id] ?? "" })}>Reset Password</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(managedUser)}>Edit</Button>
                    <Button type="button" size="sm" variant={managedUser.active ? "destructive" : "outline"} disabled={setActiveStatus.isPending} onClick={() => setActiveStatus.mutate({ id: managedUser.id, active: !managedUser.active })}>
                      {managedUser.active ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
