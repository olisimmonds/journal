/**
 * Minimal Google Drive REST client. Deliberately hand-rolled with `fetch`
 * rather than the full Google API client library, since we only ever need
 * to read/write a single file.
 *
 * The backup file lives as a normal, visible file in the root of "My Drive"
 * (not the hidden `appDataFolder`) so you can find it, open it, or download
 * it yourself at any time — see the `drive.file` scope in `googleAuth.ts`,
 * which only grants access to files this app itself created, not your
 * other Drive files.
 */

const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files'
const BACKUP_FILE_NAME = 'journal-backup.json'

async function driveFetch(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Google Drive request failed (${response.status}): ${body}`)
  }

  return response
}

/** Finds the app's single backup file in "My Drive", if it exists yet. */
export async function findBackupFileId(accessToken: string): Promise<string | null> {
  const params = new URLSearchParams({
    q: `name = '${BACKUP_FILE_NAME}' and trashed = false`,
    fields: 'files(id, modifiedTime)',
  })

  const response = await driveFetch(accessToken, `${DRIVE_FILES_ENDPOINT}?${params}`)
  const data = (await response.json()) as { files: Array<{ id: string }> }

  return data.files[0]?.id ?? null
}

export async function downloadBackupContent(
  accessToken: string,
  fileId: string,
): Promise<string> {
  const response = await driveFetch(accessToken, `${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`)
  return response.text()
}

/**
 * Creates the backup file on first sync, or overwrites its content on every
 * subsequent sync. Uses Drive's multipart upload so metadata (name, parent
 * folder) and content are set in a single request on create.
 */
export async function uploadBackupContent(
  accessToken: string,
  existingFileId: string | null,
  content: string,
): Promise<string> {
  if (existingFileId) {
    const response = await driveFetch(
      accessToken,
      `${DRIVE_UPLOAD_ENDPOINT}/${existingFileId}?uploadType=media`,
      { method: 'PATCH', body: content },
    )
    const data = (await response.json()) as { id: string }
    return data.id
  }

  const boundary = 'journal-backup-boundary'
  // No `parents` — Drive defaults to creating the file in the root of "My
  // Drive", where you can see it directly.
  const metadata = { name: BACKUP_FILE_NAME }

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n')

  const response = await driveFetch(
    accessToken,
    `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipartBody,
    },
  )

  const data = (await response.json()) as { id: string }
  return data.id
}
