import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/services/api'
import { uploadVideo, validateVideoFile } from './media'

vi.mock('@/services/api', () => ({
  apiFetch: vi.fn(),
}))

describe('video media uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts supported video files up to the upload limit', () => {
    expect(validateVideoFile(new File(['video'], 'clip.MP4', { type: 'video/mp4' }))).toBeNull()
    expect(validateVideoFile(new File(['video'], 'clip.exe'))).toMatch(/Unsupported video format/)
    expect(
      validateVideoFile({
        name: 'clip.mp4',
        size: 100 * 1024 * 1024 + 1,
      }),
    ).toMatch(/limit is 100MB/)
  })

  it('sends video uploads as multipart video media and returns the hosted URL', async () => {
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    apiFetch.mockResolvedValue({ data: { url: 'https://cdn.example/clip.mp4', path: 'news/clip' } })

    await expect(uploadVideo(file, { token: 'token', folder: 'news' })).resolves.toEqual({
      url: 'https://cdn.example/clip.mp4',
      path: 'news/clip',
    })

    const [path, options] = apiFetch.mock.calls[0]
    expect(path).toBe('/admin/media')
    expect(options.method).toBe('POST')
    expect(options.body.get('file')).toBe(file)
    expect(options.body.get('folder')).toBe('news')
    expect(options.body.get('resource_type')).toBe('video')
  })
})
