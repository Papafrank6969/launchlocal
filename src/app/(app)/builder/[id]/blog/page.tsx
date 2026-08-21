"use client";

import { use, useEffect, useState } from "react";
import { BuilderTabs } from "@/components/BuilderTabs";
import { FormStatus, type StatusMessage } from "@/components/FormStatus";

type BlogPost = { id: string; title: string; content: string; published: boolean; slug: string };

export default function BlogAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);

  useEffect(() => {
    fetch(`/api/sites/${id}/blog`)
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []));
  }, [id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setAdding(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/sites/${id}/blog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't create post");
      setPosts((prev) => [data.post, ...(prev ?? [])]);
      setTitle("");
      setContent("");
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Couldn't create post" });
    } finally {
      setAdding(false);
    }
  }

  function updatePost(postId: string, patch: Partial<BlogPost>) {
    setPosts((prev) => (prev ?? []).map((p) => (p.id === postId ? { ...p, ...patch } : p)));
  }

  async function savePost(post: BlogPost) {
    await fetch(`/api/sites/${id}/blog/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: post.title, content: post.content }),
    });
  }

  async function togglePublished(post: BlogPost) {
    const published = !post.published;
    updatePost(post.id, { published });
    await fetch(`/api/sites/${id}/blog/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    });
  }

  async function removePost(postId: string) {
    await fetch(`/api/sites/${id}/blog/${postId}`, { method: "DELETE" });
    setPosts((prev) => (prev ?? []).filter((p) => p.id !== postId));
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-900">Blog</h1>
      <p className="mt-1 text-slate-600">Posts shown on this site&apos;s blog. Unpublished posts aren&apos;t visible yet.</p>
      <BuilderTabs id={id} />

      <div className="mt-8 space-y-4">
        {posts === null && <p className="text-sm text-slate-500">Loading…</p>}
        {posts?.length === 0 && <p className="text-sm text-slate-500">No posts yet.</p>}
        {posts?.map((post) => (
          <div key={post.id} className="rounded-md border border-slate-200 p-4">
            <div className="flex items-start gap-2">
              <input
                className="input font-medium"
                value={post.title}
                onChange={(e) => updatePost(post.id, { title: e.target.value })}
                onBlur={() => savePost(post)}
              />
              <button
                type="button"
                onClick={() => togglePublished(post)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
                  post.published ? "bg-emerald-100 text-emerald-700" : "border border-slate-300 text-slate-600"
                }`}
              >
                {post.published ? "Published" : "Draft"}
              </button>
              <button
                type="button"
                onClick={() => removePost(post.id)}
                className="shrink-0 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-red-600"
              >
                Remove
              </button>
            </div>
            <textarea
              className="input mt-2 min-h-32 text-sm"
              value={post.content}
              onChange={(e) => updatePost(post.id, { content: e.target.value })}
              onBlur={() => savePost(post)}
            />
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="mt-8 space-y-3 rounded-md border border-dashed border-slate-300 p-4">
        <p className="text-sm font-medium text-slate-700">New post</p>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <textarea
          className="input min-h-32"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Post content — separate paragraphs with a blank line."
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {adding ? "Creating…" : "Create post (draft)"}
        </button>
        <FormStatus status={status} />
      </form>
    </div>
  );
}
