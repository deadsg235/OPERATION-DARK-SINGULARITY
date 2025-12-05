using UnityEngine;

public class WeaponController : MonoBehaviour
{
    [Header("Weapon Stats")]
    public int damage = 25;
    public float fireRate = 0.1f;
    public float range = 100f;
    public int maxAmmo = 30;
    public float reloadTime = 2f;
    
    [Header("Effects")]
    public ParticleSystem muzzleFlash;
    public GameObject impactEffect;
    public AudioSource audioSource;
    public AudioClip fireSound;
    public AudioClip reloadSound;
    
    [Header("Recoil")]
    public float recoilForce = 2f;
    public float recoilRecovery = 5f;
    
    private int currentAmmo;
    private float nextTimeToFire = 0f;
    private bool isReloading = false;
    private Camera playerCamera;
    private Vector3 originalPosition;
    private Vector3 recoilOffset;
    
    void Start()
    {
        currentAmmo = maxAmmo;
        playerCamera = Camera.main;
        originalPosition = transform.localPosition;
    }
    
    void Update()
    {
        // Smooth recoil recovery
        if (recoilOffset.magnitude > 0.01f)
        {
            recoilOffset = Vector3.Lerp(recoilOffset, Vector3.zero, recoilRecovery * Time.deltaTime);
            transform.localPosition = originalPosition + recoilOffset;
        }
    }
    
    public void Fire()
    {
        if (isReloading || currentAmmo <= 0 || Time.time < nextTimeToFire)
            return;
        
        nextTimeToFire = Time.time + fireRate;
        currentAmmo--;
        
        // Muzzle flash
        if (muzzleFlash)
            muzzleFlash.Play();
        
        // Sound
        if (audioSource && fireSound)
            audioSource.PlayOneShot(fireSound);
        
        // Recoil
        ApplyRecoil();
        
        // Raycast for hit detection
        RaycastHit hit;
        if (Physics.Raycast(playerCamera.transform.position, playerCamera.transform.forward, out hit, range))
        {
            // Check if we hit an enemy
            AndroidEnemy enemy = hit.collider.GetComponent<AndroidEnemy>();
            if (enemy)
            {
                enemy.TakeDamage(damage);
            }
            
            // Impact effect
            if (impactEffect)
            {
                GameObject impact = Instantiate(impactEffect, hit.point, Quaternion.LookRotation(hit.normal));
                Destroy(impact, 2f);
            }
        }
        
        // Auto reload when empty
        if (currentAmmo <= 0)
        {
            Reload();
        }
    }
    
    void ApplyRecoil()
    {
        // Random recoil pattern
        float recoilX = Random.Range(-recoilForce, recoilForce) * 0.01f;
        float recoilY = Random.Range(-recoilForce * 0.5f, recoilForce) * 0.01f;
        float recoilZ = Random.Range(-recoilForce * 0.3f, 0f) * 0.01f;
        
        recoilOffset += new Vector3(recoilX, recoilY, recoilZ);
        
        // Camera kick
        if (playerCamera)
        {
            playerCamera.transform.Rotate(-recoilForce * 0.5f, Random.Range(-recoilForce * 0.2f, recoilForce * 0.2f), 0);
        }
    }
    
    public void Reload()
    {
        if (isReloading || currentAmmo == maxAmmo)
            return;
        
        StartCoroutine(ReloadCoroutine());
    }
    
    System.Collections.IEnumerator ReloadCoroutine()
    {
        isReloading = true;
        
        if (audioSource && reloadSound)
            audioSource.PlayOneShot(reloadSound);
        
        yield return new WaitForSeconds(reloadTime);
        
        currentAmmo = maxAmmo;
        isReloading = false;
    }
    
    public int GetCurrentAmmo() => currentAmmo;
    public int GetMaxAmmo() => maxAmmo;
    public bool IsReloading() => isReloading;
}