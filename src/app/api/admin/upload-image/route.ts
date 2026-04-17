import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const BUCKET = 'product-images';

// POST /api/admin/upload-image
// multipart form: file (image), product_id (optional), slug (for filename)
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Parse multipart form
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const productId = formData.get('product_id') as string | null;
    const slug = formData.get('slug') as string | null; // e.g. "sakkare-pongal"

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 });
    }

    // Build filename: slug-based so manual gallery uploads also match
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const filename = slug ? `${slug}.${ext}` : `product-${Date.now()}.${ext}`;
    const path = filename;

    // Convert to ArrayBuffer for upload
    const buffer = await file.arrayBuffer();

    // Upload to Supabase Storage (upsert = overwrite existing)
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // If product_id provided, update the product record
    if (productId) {
      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: publicUrl })
        .eq('id', productId);

      if (updateError) throw updateError;
    }

    return NextResponse.json({ url: publicUrl, path });
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// DELETE /api/admin/upload-image?path=xxx
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');
    const productId = searchParams.get('product_id');

    if (path) {
      await supabase.storage.from(BUCKET).remove([path]);
    }

    if (productId) {
      await supabase
        .from('products')
        .update({ image_url: null })
        .eq('id', productId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Image delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
