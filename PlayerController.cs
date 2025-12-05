using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class PlayerController : MonoBehaviour
{
    [Header("Movement")]
    public float walkSpeed = 6f;
    public float runSpeed = 12f;
    public float jumpHeight = 3f;
    public float gravity = -20f;
    
    [Header("Mouse Look")]
    public float mouseSensitivity = 2f;
    public Transform cameraTransform;
    
    [Header("Weapon")]
    public Transform weaponHolder;
    public WeaponController currentWeapon;
    
    private CharacterController controller;
    private Vector3 velocity;
    private float xRotation = 0f;
    private bool isRunning;
    
    void Start()
    {
        controller = GetComponent<CharacterController>();
        Cursor.lockState = CursorLockMode.Locked;
        
        if (!cameraTransform)
            cameraTransform = Camera.main.transform;
    }
    
    void Update()
    {
        HandleMouseLook();
        HandleMovement();
        HandleWeapon();
    }
    
    void HandleMouseLook()
    {
        float mouseX = Input.GetAxis("Mouse X") * mouseSensitivity;
        float mouseY = Input.GetAxis("Mouse Y") * mouseSensitivity;
        
        xRotation -= mouseY;
        xRotation = Mathf.Clamp(xRotation, -90f, 90f);
        
        cameraTransform.localRotation = Quaternion.Euler(xRotation, 0f, 0f);
        transform.Rotate(Vector3.up * mouseX);
    }
    
    void HandleMovement()
    {
        float x = Input.GetAxis("Horizontal");
        float z = Input.GetAxis("Vertical");
        
        isRunning = Input.GetKey(KeyCode.LeftShift);
        float currentSpeed = isRunning ? runSpeed : walkSpeed;
        
        Vector3 move = transform.right * x + transform.forward * z;
        controller.Move(move * currentSpeed * Time.deltaTime);
        
        if (controller.isGrounded && velocity.y < 0)
        {
            velocity.y = -2f;
        }
        
        if (Input.GetButtonDown("Jump") && controller.isGrounded)
        {
            velocity.y = Mathf.Sqrt(jumpHeight * -2f * gravity);
        }
        
        velocity.y += gravity * Time.deltaTime;
        controller.Move(velocity * Time.deltaTime);
    }
    
    void HandleWeapon()
    {
        if (currentWeapon)
        {
            if (Input.GetButton("Fire1"))
            {
                currentWeapon.Fire();
            }
            
            if (Input.GetKeyDown(KeyCode.R))
            {
                currentWeapon.Reload();
            }
        }
    }
    
    public void TakeDamage(int damage)
    {
        GameManager.Instance.PlayerTakeDamage(damage);
        
        // Screen shake effect
        StartCoroutine(ScreenShake(0.1f, 0.2f));
    }
    
    System.Collections.IEnumerator ScreenShake(float duration, float magnitude)
    {
        Vector3 originalPos = cameraTransform.localPosition;
        float elapsed = 0f;
        
        while (elapsed < duration)
        {
            float x = Random.Range(-1f, 1f) * magnitude;
            float y = Random.Range(-1f, 1f) * magnitude;
            
            cameraTransform.localPosition = new Vector3(originalPos.x + x, originalPos.y + y, originalPos.z);
            
            elapsed += Time.deltaTime;
            yield return null;
        }
        
        cameraTransform.localPosition = originalPos;
    }
}