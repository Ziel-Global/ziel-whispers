-- Add document_link column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS document_link text;
