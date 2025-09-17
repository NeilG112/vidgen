"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

const ADMIN_EMAIL = 'neilganguly2007@gmail.com';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      if (user.email !== ADMIN_EMAIL) return;
      setIsLoading(true);
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${idToken}` } });
      const data = await res.json();
      setUsers(data.users || []);
      setIsLoading(false);
    }
    load();
  }, [user]);

  if (loading) return <div>Loading...</div>;
  if (!user || user.email !== ADMIN_EMAIL) return <div>Forbidden</div>;

  const updateCredits = async (uid: string, scraping?: number, video?: number) => {
    const idToken = await user.getIdToken();
    await fetch(`/api/admin/users/${uid}/credits`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ scraping, video }),
    });
    // refresh
    const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${idToken}` } });
    const data = await res.json();
    setUsers(data.users || []);
  };

  const resetAll = async () => {
    if (!confirm('Reset credits for all users now?')) return;
    const idToken = await user.getIdToken();
    await fetch('/api/admin/reset', { method: 'POST', headers: { Authorization: `Bearer ${idToken}` } });
    const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${idToken}` } });
    const data = await res.json();
    setUsers(data.users || []);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
      <div className="mb-4">
        <button className="btn" onClick={resetAll}>Reset monthly credits for all users</button>
      </div>
      {isLoading ? <div>Loading users...</div> : (
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2">UID</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Scraping</th>
              <th className="text-left p-2">Video</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <React.Fragment key={u.uid}>
                <tr className="border-t">
                  <td className="p-2">{u.uid}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">
                    <input defaultValue={u.credits?.scraping ?? 0} type="number" min={0} id={`scr-${u.uid}`} className="w-20" />
                  </td>
                  <td className="p-2">
                    <input defaultValue={u.credits?.video ?? 0} type="number" min={0} id={`vid-${u.uid}`} className="w-20" />
                  </td>
                  <td className="p-2 text-sm text-muted-foreground">
                    {u.credits?.resetAt ? new Date(u.credits.resetAt).toLocaleString() : '—'}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        const scraping = Number((document.getElementById(`scr-${u.uid}`) as HTMLInputElement).value || 0);
                        const video = Number((document.getElementById(`vid-${u.uid}`) as HTMLInputElement).value || 0);
                        await updateCredits(u.uid, scraping, video);
                      }} className="btn">Save</button>
                      <button onClick={() => setExpanded(prev => ({ ...prev, [u.uid]: !prev[u.uid] }))} className="btn">{expanded[u.uid] ? 'Hide' : 'Usage'}</button>
                    </div>
                  </td>
                </tr>
                {expanded[u.uid] && (
                  <tr className="bg-muted/10">
                    <td colSpan={6} className="p-3">
                      <div className="space-y-2">
                        <h4 className="font-medium">Recent usage</h4>
                        {(!u.usage || u.usage.length === 0) && <div className="text-sm text-muted-foreground">No recent usage</div>}
                        {u.usage && u.usage.map((item: any) => (
                          <div key={item.id} className="text-sm flex justify-between">
                            <div>{item.type} — {item.amount}</div>
                            <div className="text-xs text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
